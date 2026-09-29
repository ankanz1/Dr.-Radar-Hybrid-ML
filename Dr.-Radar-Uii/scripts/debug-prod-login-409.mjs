// TEMPORARY DIAGNOSTIC v2 — production browser flow (signup → onboarding →
// signout → login) on the DEPLOYED app. One continuous session: no
// clear+reload (the app's persist effect writes DEFAULT_USER to localStorage
// on mount, so a reload boots a phantom dashboard). Captures every
// /rest/v1/users response (status + body). Prints error payloads only.
// Usage: node scripts/debug-prod-login-409.mjs
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'https://dr-radar-hybrid-ml.vercel.app/';
const DEBUG_PORT = 9228;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-409b-${Date.now()}`,
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
const restCalls = []; // {requestId, url, status, method}
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    consoleErrors.push(msg.params.args?.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 260));
  } else if (msg.method === 'Network.responseReceived') {
    const r = msg.params.response;
    if (r.url.includes('/rest/v1/')) {
      restCalls.push({ requestId: msg.params.requestId, url: r.url.replace(/^https:\/\/[^/]+/, ''), status: r.status });
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
  if (r.exceptionDetails) return { __error: (r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '')).slice(0, 200) };
  return r.result?.value;
};
const getResponseBody = async (requestId) => {
  try { return ((await send('Network.getResponseBody', { requestId })).body ?? '').slice(0, 400); }
  catch { return '(body unavailable)'; }
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
const dumpRest = async (label) => {
  console.log(`[${label}] rest calls:`, JSON.stringify(restCalls));
  for (const c of restCalls.filter((x) => x.status >= 400)) {
    console.log(`[${label}] REST ${c.status} ${c.url} BODY:`, await getResponseBody(c.requestId));
  }
};

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');

// --- Leg 0: fresh load (expect ghost dashboard due to DEFAULT_USER leak) ---
await send('Page.navigate', { url: APP });
await sleep(8000);
const screenState = async () => evaluate("(() => { const t = document.body.innerText; if (document.getElementById('topbar-profile-btn')) return 'dashboard'; if (t.includes('Welcome to Dr. Radar')) return 'welcome'; if (document.querySelector('form')) return 'auth-form'; return 'other'; })()");
let state = await screenState();
console.log('[boot] initial screen:', state);
console.log('[boot] localStorage:', await evaluate("localStorage.getItem('dr_radar_account_v2')?.slice(0, 160) ?? null"));

// --- Leg 1: sign out of the ghost session → welcome → signup → full onboarding ---
if (state === 'dashboard') {
  await evaluate("document.getElementById('topbar-profile-btn')?.click()");
  await sleep(900);
  const so = await evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('Sign Out')); if (b) { b.click(); return true; } return false; })()`);
  console.log('[leg1] signed out of ghost:', so);
  await sleep(3000);
  state = await screenState();
  console.log('[leg1] screen after ghost signout:', state);
}
let welcomeReached = state === 'welcome';
for (let i = 0; i < 10 && !welcomeReached; i++) { await sleep(1000); welcomeReached = (await screenState()) === 'welcome'; }
console.log('[boot] welcome reached:', welcomeReached);
if (!welcomeReached) {
  console.log('[boot] body head:', await evaluate("document.body.innerText.slice(0, 150)"));
  console.log('[boot] full ids:', await evaluate("Array.from(document.querySelectorAll('[id]')).map(e => e.id).slice(0, 40).join(', ')"));
  console.log('[boot] console errors:', consoleErrors.slice(0, 6));
  ws.close(); chrome.kill(); process.exit(4);
}

const stamp = Date.now().toString(36);
const email = `buffy.prod.${stamp}@drradar-test.com`;
const password = 'Buffy-Prod-2026!x';
console.log('[leg1] signing up:', email);

await evaluate("document.getElementById('welcome-get-started-btn').click()");
await pollFor("Boolean(document.querySelector('form'))", 10000);
await evaluate(`(() => {
  const inputs = document.querySelector('form').querySelectorAll('input');
  const set = ${setReactInput};
  set(inputs[0], 'Buffy'); set(inputs[1], 'ProdDiag');
  set(inputs[2], '${email}'); set(inputs[3], '${password}'); set(inputs[4], '${password}');
  return inputs.length;
})()`);
await evaluate("document.querySelector('form button[type=submit]').click()");
const roleReached = await pollFor("Boolean(document.getElementById('role-continue-btn'))", 15000);
console.log('[leg1] role-selection reached:', roleReached, '| authError:', await evaluate("document.querySelector('.bg-red-50')?.textContent?.slice(0, 140) ?? null"));
if (!roleReached) { await dumpRest('leg1'); console.log('[leg1] console errors:', consoleErrors.slice(0, 8)); ws.close(); chrome.kill(); process.exit(5); }
restCalls.length = 0;
await evaluate("document.getElementById('role-continue-btn').click()");
await pollFor("Boolean(document.getElementById('consent-continue-btn'))", 10000);
await evaluate("document.getElementById('consent-required-terms').click()");
await evaluate("document.getElementById('consent-continue-btn').click()");
await pollFor("Boolean(document.getElementById('profile-complete-btn'))", 10000);
await evaluate("document.getElementById('profile-complete-btn').click()");
await sleep(7000);
console.log('[leg1] after complete — topbar:', await evaluate("Boolean(document.getElementById('desktop-workspace-topbar'))"),
  '| completionError:', await evaluate("Array.from(document.querySelectorAll('.bg-red-50')).map(e => e.textContent.trim()).join(' | ').slice(0, 200) || null"));
await dumpRest('leg1');

// --- Leg 2: sign out via profile menu → sign in with same creds ---
await evaluate("document.getElementById('topbar-profile-btn')?.click()");
await sleep(800);
const signOutClicked = await evaluate(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Sign Out'));
  if (btn) { btn.click(); return true; }
  return false;
})()`);
await sleep(5000);
console.log('[leg2] signOut clicked:', signOutClicked, '| welcome visible:', await evaluate("Boolean(document.getElementById('welcome-get-started-btn') || document.getElementById('welcome-sign-in-btn'))"));

restCalls.length = 0;
consoleErrors.length = 0;
const signInBtn = await evaluate("Boolean(document.getElementById('welcome-sign-in-btn'))");
if (signInBtn) {
  await evaluate("document.getElementById('welcome-sign-in-btn').click()");
} else {
  console.log('[leg2] welcome-sign-in-btn missing; reloading app fresh (no storage clear)');
  await send('Page.navigate', { url: APP });
  await pollFor("Boolean(document.getElementById('welcome-sign-in-btn') || document.querySelector('form'))", 30000);
}
await pollFor("Boolean(document.querySelector('form'))", 15000);
await evaluate(`(() => {
  const inputs = document.querySelector('form').querySelectorAll('input');
  const set = ${setReactInput};
  set(inputs[0], '${email}'); set(inputs[1], '${password}');
  return inputs.length;
})()`);
await evaluate("document.querySelector('form button[type=submit]').click()");
await sleep(12000);
console.log('[leg2] after sign-in — topbar:', await evaluate("Boolean(document.getElementById('desktop-workspace-topbar'))"),
  '| welcome/auth visible:', await evaluate("Boolean(document.getElementById('welcome-get-started-btn') || document.querySelector('form'))"),
  '| role-selection:', await evaluate("Boolean(document.getElementById('role-continue-btn'))"),
  '| authError:', await evaluate("document.querySelector('.bg-red-50')?.textContent?.slice(0, 140) ?? null"));
await dumpRest('leg2');
console.log('[leg2] console errors:', consoleErrors.slice(0, 10).length ? consoleErrors.slice(0, 10) : '(none)');

ws.close();
chrome.kill();
console.log('[done] test email:', email);
process.exit(0);
