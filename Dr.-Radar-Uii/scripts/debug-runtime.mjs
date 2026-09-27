// TEMPORARY — Part E runtime test via Chrome DevTools Protocol (zero deps).
// Drives the real app at localhost:3000: boot check, OAuth button clicks, in-browser RLS probe.
// Prints URLs (truncated), console errors, and error codes only. No tokens/secrets.
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:3000';
const DEBUG_PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 1. Launch headless Chrome with remote debugging ---
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`, '--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-cdp-test',
  'about:blank',
], { stdio: 'ignore' });
chrome.on('error', (e) => { console.error('Chrome spawn failed:', e.message); process.exit(1); });

// --- 2. Wait for CDP endpoint ---
let targets = null;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
    targets = await res.json();
    break;
  } catch { await sleep(500); }
}
if (!targets) { console.error('CDP endpoint never came up'); chrome.kill(); process.exit(1); }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let msgId = 0;
const pending = new Map();
const consoleLogs = [];
const navigations = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleLogs.push(msg.params.args?.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  } else if (msg.method === 'Page.frameNavigated' && msg.params.frame?.url && msg.params.frame.url !== 'about:blank') {
    navigations.push(msg.params.frame.url);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
    userGesture: true,
  });
  return r.result?.value;
};

await send('Runtime.enable');
await send('Page.enable');

// --- 3. Boot check (fresh storage each leg — localStorage persists across navigations) ---
const pollFor = async (expr, timeoutMs = 15000, intervalMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await evaluate(expr);
    if (found) return true;
    await sleep(intervalMs);
  }
  return false;
};

const freshLoad = async () => {
  await send('Page.navigate', { url: APP });
  await sleep(2000);
  await evaluate('localStorage.clear(); "cleared"');
  await send('Page.reload');
  // Wait through the 3.4s entry animation for the welcome step
  await pollFor("Boolean(document.getElementById('welcome-get-started-btn'))", 15000);
};

await freshLoad();
const boot = await evaluate(`({
  url: location.href,
  rootChildren: document.getElementById('root')?.children.length ?? 0,
  hasWelcome: Boolean(document.getElementById('welcome-get-started-btn')),
  hasAuthStep: Boolean(document.querySelector('form')),
  title: document.title,
})`);
console.log('[boot]', JSON.stringify(boot));

// --- 4. OAuth click tests: verify real provider navigation from the real app ---
const oauthTest = async (provider, imgSrc) => {
  await freshLoad();
  navigations.length = 0;
  // Walk the real onboarding flow: welcome → Get Started → auth step
  await evaluate(`(() => {
    const getStarted = document.getElementById('welcome-get-started-btn');
    if (getStarted) getStarted.click();
    return true;
  })()`);
  const authReady = await pollFor(
    `Boolean(document.querySelector('button img[src="${imgSrc}"]'))`, 10000
  );
  if (!authReady) { console.log(`[oauth:${provider}] auth step with provider button never appeared`); return; }
  const clicked = await evaluate(`(() => {
    const btn = document.querySelector('button img[src="${imgSrc}"]')?.closest('button');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!clicked) { console.log(`[oauth:${provider}] button not found even on auth step`); return; }
  await sleep(9000);
  const finalUrl = await evaluate('location.href');
  const navHit = navigations.some((u) => u.includes(provider === 'google' ? 'accounts.google.com' : 'facebook.com'));
  const urlHit = /accounts\.google\.com|facebook\.com/.test(finalUrl ?? '');
  const errorSign = /err=|error=|denied|invalid/i.test(finalUrl ?? '');
  console.log(`[oauth:${provider}] clicked=${clicked} reachedProvider=${navHit || urlHit} errorInUrl=${errorSign}`);
  if (finalUrl) console.log(`[oauth:${provider}] final URL (truncated): ${String(finalUrl).slice(0, 110)}`);
};

await oauthTest('google', '/google.png');
await oauthTest('facebook', '/facebook.png');

// --- 5. In-browser anon RLS probe with the APP'S OWN supabase client ---
await freshLoad();
const probe = await evaluate(`(async () => {
  try {
    const mod = await import('/src/lib/supabase.ts');
    const sb = mod.supabase;
    const fakeId = '22222222-2222-2222-2222-222222222222';
    const u = await sb.from('users').upsert({
      id: fakeId, email: 'probe@drradar-test.com', role: 'patient',
      first_name: 'P', last_name: 'R', display_name: 'PR', password_hash: 'x',
    }, { onConflict: 'id' });
    const p = await sb.from('patients').upsert({ user_id: fakeId }, { onConflict: 'user_id' });
    return {
      users: { code: u.error?.code ?? 'OK', message: (u.error?.message ?? 'insert blocked by RLS as expected').slice(0, 140) },
      patients: { code: p.error?.code ?? 'OK', message: (p.error?.message ?? 'insert blocked by RLS as expected').slice(0, 140) },
    };
  } catch (e) {
    return { setupError: String(e?.message ?? e).slice(0, 200) };
  }
})()`);
console.log('[anon-rls-probe from app origin]', JSON.stringify(probe, null, 2));

// --- 6. Console errors observed during the session ---
console.log('[console errors observed]', consoleLogs.length ? consoleLogs.slice(0, 10) : '(none)');

ws.close();
chrome.kill();
console.log('[done] runtime test complete');
process.exit(0);
