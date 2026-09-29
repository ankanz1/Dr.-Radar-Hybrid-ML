// TEMPORARY DIAGNOSTIC — drive the LOCAL WORKING TREE (vite dev server) through
// a full signup → onboarding → profile save with a throwaway account, capture
// every /rest/v1/ response (status + body) and the completion error banner.
// Usage: node scripts/debug-live-save-repro.mjs   (vite on :5277 required)
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.REPRO_APP ?? 'http://localhost:5277/';
const DEBUG_PORT = 9231;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-save-${Date.now()}`,
  'about:blank',
], { stdio: 'ignore' });
chrome.on('error', (e) => { console.error('Chrome spawn failed:', e.message); process.exit(1); });

let targets = null;
for (let i = 0; i < 30; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json(); break; }
  catch { await sleep(500); }
}
if (!targets) { console.error('CDP endpoint never came up'); chrome.kill(); process.exit(1); }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const restCalls = [];
const restBodies = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    consoleErrors.push(msg.params.args?.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  } else if (msg.method === 'Network.responseReceived') {
    const r = msg.params.response;
    if (r.url.includes('/rest/v1/')) {
      restCalls.push({ requestId: msg.params.requestId, url: r.url.replace(/^https:\/\/[^/]+/, '').slice(0, 120), status: r.status });
    }
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) return { __error: (r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '')).slice(0, 300) };
  return r.result?.value;
};
const getResponseBody = async (requestId) => {
  try { return ((await send('Network.getResponseBody', { requestId })).body ?? '').slice(0, 500); }
  catch { return '(body unavailable)'; }
};
const dumpRest = async (label) => {
  for (const c of restCalls) {
    console.log(`[${label}] REST ${c.status} ${c.url}`);
    if (c.status >= 400) console.log(`[${label}]   BODY:`, await getResponseBody(c.requestId));
  }
};
const pollFor = async (expr, timeoutMs = 20000, intervalMs = 400) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expr)) return true;
    await sleep(intervalMs);
  }
  return false;
};
const setReactInput = `((el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); })`;
const errBanners = `Array.from(document.querySelectorAll('.bg-red-50')).map(e => e.textContent.trim()).join(' | ').slice(0, 250) || null`;

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');

// Fresh load — clear storage first so no ghost account interferes.
await send('Page.navigate', { url: APP });
await sleep(6000);
await evaluate("localStorage.clear(); sessionStorage.clear();");
await send('Page.navigate', { url: APP });
await sleep(6000);
const screenState = async () => evaluate("(() => { const t = document.body.innerText; if (document.getElementById('topbar-profile-btn')) return 'dashboard'; if (t.includes('Welcome to Dr. Radar')) return 'welcome'; if (document.querySelector('form')) return 'auth-form'; return 'other: ' + t.slice(0, 80); })()");
let state = await screenState();
console.log('[boot] screen:', state);

if (!state.startsWith('welcome')) {
  console.log('[boot] no welcome screen — aborting (state:', state, ')');
  ws.close(); chrome.kill(); process.exit(4);
}

// Signup leg
const stamp = Date.now().toString(36);
const email = `buffy.live.${stamp}@drradar-test.com`;
const password = 'Buffy-Live-2026!x';
console.log('[signup] creating:', email);
await evaluate("document.getElementById('welcome-get-started-btn')?.click()");
await pollFor("Boolean(document.querySelector('form'))", 10000);
await evaluate(`(() => {
  const inputs = document.querySelector('form').querySelectorAll('input');
  const set = ${setReactInput};
  set(inputs[0], 'Buffy'); set(inputs[1], 'Live');
  set(inputs[2], '${email}'); set(inputs[3], '${password}'); set(inputs[4], '${password}');
  return inputs.length;
})()`);
await evaluate("document.querySelector('form button[type=submit]').click()");
const roleReached = await pollFor("Boolean(document.getElementById('role-continue-btn'))", 15000);
console.log('[signup] role-selection reached:', roleReached, '| authError:', await evaluate(errBanners));
if (!roleReached) { await dumpRest('signup'); console.log('[signup] console errors:', consoleErrors.slice(0, 8)); ws.close(); chrome.kill(); process.exit(5); }

restCalls.length = 0;
// Onboarding: role → consent → profile-setup → complete
await evaluate("document.getElementById('role-continue-btn').click()");
await pollFor("Boolean(document.getElementById('consent-continue-btn'))", 10000);
await sleep(1200); // let the step animation settle before interacting
const probe = await evaluate("(() => { const els = Array.from(document.querySelectorAll('#consent-required-terms')); return els.map((el) => ({ count: els.length, checked: el.checked, visible: !!(el.offsetParent || el.getClientRects().length), form: el.form ? 'yes' : 'no' })); })()");
console.log('[onboarding] consent checkbox probe:', JSON.stringify(probe));
await evaluate("(() => { const el = document.getElementById('consent-required-terms'); el.scrollIntoView({block: 'center'}); const r = el.getBoundingClientRect(); const opts = {bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2}; el.dispatchEvent(new PointerEvent('pointerdown', opts)); el.dispatchEvent(new MouseEvent('mousedown', opts)); el.dispatchEvent(new PointerEvent('pointerup', opts)); el.dispatchEvent(new MouseEvent('mouseup', opts)); el.click(); return el.checked; })()");
await sleep(400);
console.log('[onboarding] terms checked:', await evaluate("(() => { const el = document.getElementById('consent-required-terms'); if (el && !el.checked) el.click(); return document.getElementById('consent-required-terms')?.checked; })()"));
await evaluate("document.getElementById('consent-continue-btn').click()");
const profReached = await pollFor("Boolean(document.getElementById('profile-complete-btn'))", 10000);
console.log('[onboarding] profile-setup reached:', profReached, '| error:', await evaluate(errBanners));
if (!profReached) { await dumpRest('onboarding'); ws.close(); chrome.kill(); process.exit(6); }

console.log('[save] clicking profile-complete-btn…');
await evaluate("document.getElementById('profile-complete-btn').click()");
await sleep(9000);
console.log('[save] dashboard topbar:', await evaluate("Boolean(document.getElementById('desktop-workspace-topbar'))"),
  '| completionError:', await evaluate(errBanners));
await dumpRest('save');
console.log('[save] console errors:', consoleErrors.slice(0, 10).length ? consoleErrors.slice(0, 10) : '(none)');

ws.close();
chrome.kill();
console.log('[done] test email:', email);
process.exit(0);
