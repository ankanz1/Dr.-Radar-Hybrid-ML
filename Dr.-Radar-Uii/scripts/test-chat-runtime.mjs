// TEMPORARY — Phase 4 Step 2 runtime test via Chrome DevTools Protocol (zero deps).
// Drives the real app at localhost:3000 and verifies the patient chat entry:
//   1. Messages nav item exists and reaches the chat screen
//   2. No-appointment empty state renders ("No appointment conversations yet.")
//   3. Empty-state CTA navigates to the Connect With Doctor flow
//   4. No chat-related console errors during the flow
// Prints pass/fail lines only. No tokens/secrets.
// Usage: node scripts/test-chat-runtime.mjs   (dev server must run on :3000)
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:3000';
const DEBUG_PORT = 9226;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let FAIL = 0;
const failures = [];
const check = (name, ok, extra = '') => {
  if (ok) { PASS++; console.log(`  PASS  ${name}`); }
  else { FAIL++; failures.push(name); console.log(`  FAIL  ${name} ${extra}`); }
};

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-cdp-chat-test',
  'about:blank',
], { stdio: 'ignore' });
chrome.on('error', (e) => { console.error('Chrome spawn failed:', e.message); process.exit(1); });

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
const consoleErrors = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    const text = msg.params.args?.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160);
    if (/token|secret|password|apikey/i.test(text ?? '')) return; // never capture secrets
    consoleErrors.push(text);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'page eval failed');
  return r.result?.value;
};
const pollFor = async (expr, timeoutMs = 20000, intervalMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await evaluate(expr)) return true; } catch { /* page busy */ }
    await sleep(intervalMs);
  }
  return false;
};

await send('Runtime.enable');
await send('Page.enable');
// Desktop layout so the left sidebar (and its nav ids) is rendered.
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// --- Boot the app with a completed local patient account (skips onboarding) ---
await send('Page.navigate', { url: APP });
await sleep(2500);
await evaluate('localStorage.clear(); "ok"');
await evaluate(`localStorage.setItem('dr_radar_account_v2', JSON.stringify({
  userId: 'USR-CDPCHAT', firstName: 'Test', lastName: 'Patient', displayName: 'Test Patient',
  email: 'cdp-chat@example.com', role: 'patient', profilePictureType: 'none', profilePicture: null,
  avatarUrl: '', dob: '1990-01-01', gender: 'Male', country: 'United States', language: 'English (US)',
  onboardingCompleted: true, profileCompleted: true, termsAccepted: true,
  notifications: { analysisResults: true, appointmentReminders: true, healthAlerts: true, researchUpdates: false, productUpdates: true },
  security: { twoFactorEnabled: false, activeSessionsCount: 1, lastPasswordChange: '2026-09-28' },
  createdAt: '2026-09-28',
})); "ok"`);
await evaluate(`localStorage.setItem('dr_radar_onboarding_step_v2', 'completed'); "ok"`);
await send('Page.reload');
await sleep(3500);

const appReady = await pollFor("document.querySelectorAll('button').length > 3", 20000);
check('app booted to patient shell', appReady);

// --- 1. Messages entry point exists in patient navigation ---
const navItem = await evaluate(`Boolean(document.querySelector('#nav-journey-messages'))`);
check('Messages nav item rendered in patient sidebar', navItem === true);

// --- 2. Click it: chat screen opens with the no-appointments empty state ---
await evaluate(`document.querySelector('#nav-journey-messages').click()`);
const emptyState = await pollFor(
  `document.body.textContent.includes('No appointment conversations yet.')`,
  20000
);
check('chat screen shows no-appointments empty state', emptyState);
const emptyCopy = await pollFor(
  `document.body.textContent.includes('Book an appointment with a doctor to start chatting')`,
  5000
);
check('empty state explains how to start a conversation', emptyCopy);

// --- 3. Empty-state CTA navigates to Connect With Doctor ---
await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Connect With Doctor'));
  if (btn) { btn.click(); return true; } return false;
})()`);
const navToDoctors = await pollFor(
  `document.querySelector('#nav-journey-doctors')?.getAttribute('aria-current') === 'page'`,
  10000
);
check('empty-state CTA navigates to Connect With Doctor', navToDoctors);

// --- 4. No chat-related console errors during the flow ---
const chatErrors = consoleErrors.filter((e) => /chat|message/i.test(e ?? ''));
check('no chat-related console errors', chatErrors.length === 0, JSON.stringify(chatErrors.slice(0, 3)));

console.log(`\n[chat-runtime] ${PASS} passed, ${FAIL} failed`);
chrome.kill();
process.exit(FAIL === 0 ? 0 : 1);
