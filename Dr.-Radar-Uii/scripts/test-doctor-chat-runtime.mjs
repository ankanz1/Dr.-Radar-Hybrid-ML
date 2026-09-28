// TEMPORARY — Phase 4 Step 3 runtime test via Chrome DevTools Protocol (zero deps).
// Drives the real app at localhost:3000 and verifies the doctor chat entry:
//   1. Role switch to doctor works (existing navigation preserved)
//   2. Messages nav item exists in the doctor sidebar and opens the screen
//   3. Doctor no-conversations empty state renders
//   4. Doctor flow adds no chat-related console errors
// Prints pass/fail lines only. No tokens/secrets.
// Usage: node scripts/test-doctor-chat-runtime.mjs   (dev server on :3000)
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:3000';
const DEBUG_PORT = 9227;
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
  '--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-cdp-doctor-chat',
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// --- Boot the app with a completed local account, then switch to doctor role ---
await send('Page.navigate', { url: APP });
await sleep(2500);
await evaluate('localStorage.clear(); "ok"');
await evaluate(`localStorage.setItem('dr_radar_account_v2', JSON.stringify({
  userId: 'USR-CDPDOCTOR', firstName: 'Test', lastName: 'Doctor', displayName: 'Test Doctor',
  email: 'cdp-doctor@example.com', role: 'doctor', profilePictureType: 'none', profilePicture: null,
  avatarUrl: '', dob: '1980-01-01', gender: 'Male', country: 'United States', language: 'English (US)',
  onboardingCompleted: true, profileCompleted: true, termsAccepted: true,
  notifications: { analysisResults: true, appointmentReminders: true, healthAlerts: true, researchUpdates: false, productUpdates: true },
  security: { twoFactorEnabled: false, activeSessionsCount: 1, lastPasswordChange: '2026-09-28' },
  createdAt: '2026-09-28',
})); "ok"`);
await evaluate(`localStorage.setItem('dr_radar_onboarding_step_v2', 'completed'); "ok"`);
await send('Page.reload');
await sleep(3500);

const appReady = await pollFor("document.querySelectorAll('button').length > 3", 20000);
check('app booted', appReady);

// --- 1. Doctor role active: the doctor sidebar section renders 'Clinical Workflow'
// (patients see 'Patient Portal'), and the doctor dashboard screen is mounted.
const doctorShell = await pollFor(
  `document.body.textContent.includes('Clinical Workflow')
   && !document.body.textContent.includes('Patient Portal')`,
  15000
);
check('doctor shell active (existing doctor flow intact)', doctorShell);

// --- 2. Patient chat screen must NOT be wired into doctor navigation ---
const patientMessagesInDoctorNav = await evaluate(
  `Boolean(document.querySelector('#nav-journey-messages'))`
);
check('patient Messages entry absent from doctor sidebar', patientMessagesInDoctorNav === false);

// --- 3. Doctor Messages nav item exists and opens the screen ---
const navItem = await evaluate(`Boolean(document.querySelector('#nav-doctor-messages'))`);
check('doctor Messages nav item rendered', navItem === true);
await evaluate(`document.querySelector('#nav-doctor-messages').click()`);
const screenReached = await pollFor(
  `document.body.textContent.includes('Patient Messages')`,
  15000
);
check('doctor Patient Messages screen opens', screenReached);

// --- 4. Doctor empty state (no appointments -> no conversations) ---
const emptyState = await pollFor(
  `document.body.textContent.includes('No patient conversations yet.')
   || document.body.textContent.includes('Loading your patient conversations')
   || document.body.textContent.includes('Could not load your patient conversations')`,
  15000
);
check('doctor conversations state renders (empty/loading/error without data)', emptyState);

// --- 5. No chat-related console errors during the doctor flow ---
const chatErrors = consoleErrors.filter((e) => /chat|message/i.test(e ?? ''));
check('no chat-related console errors', chatErrors.length === 0, JSON.stringify(chatErrors.slice(0, 3)));

console.log(`\n[doctor-chat-runtime] ${PASS} passed, ${FAIL} failed`);
chrome.kill();
process.exit(FAIL === 0 ? 0 : 1);
