// TEMPORARY — Appointment-card Chat runtime test via Chrome DevTools Protocol.
// Drives the real app at localhost:3000. The test profile has no live Supabase
// session, so the page's fetch is shimmed for the two REST endpoints the chat
// flow uses (appointments, messages) + the doctor-directory RPC. This verifies:
//   1. Every appointment card renders a Chat button
//   2. Clicking a card's Chat opens the chat for THAT appointment
//      (messages query is issued for the clicked appointment id only)
//   3. The chat header shows the correct doctor name (directory overlay works)
//   4. Normal Messages navigation falls back to the default conversation
// Prints pass/fail lines only. No tokens/secrets.
// Usage: node scripts/test-appointment-chat-runtime.mjs   (dev server on :3000)
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:3000';
const DEBUG_PORT = 9228;
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
  '--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-cdp-appt-chat',
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

const jsonResponse = (payload) => `new Response(JSON.stringify(${JSON.stringify(payload)}), {
  status: 200, headers: { 'Content-Type': 'application/json' }
})`;

// --- Boot + seed a completed local patient account ---
await send('Page.navigate', { url: APP });
await sleep(2500);
await evaluate('localStorage.clear(); "ok"');
await evaluate(`localStorage.setItem('dr_radar_account_v2', JSON.stringify({
  userId: 'USR-CDPAPPT', firstName: 'Test', lastName: 'Patient', displayName: 'Test Patient',
  email: 'cdp-appt@example.com', role: 'patient', profilePictureType: 'none', profilePicture: null,
  avatarUrl: '', dob: '1990-01-01', gender: 'Male', country: 'United States', language: 'English (US)',
  onboardingCompleted: true, profileCompleted: true, termsAccepted: true,
  notifications: { analysisResults: true, appointmentReminders: true, healthAlerts: true, researchUpdates: false, productUpdates: true },
  security: { twoFactorEnabled: false, activeSessionsCount: 1, lastPasswordChange: '2026-09-28' },
  createdAt: '2026-09-28',
})); "ok"`);
await evaluate(`localStorage.setItem('dr_radar_onboarding_step_v2', 'completed'); "ok"`);

// --- Shim the Supabase REST endpoints via addScriptToEvaluateOnNewDocument so
// the shim survives reloads/HMR. Auth/ECG calls pass through untouched. ---
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    window.__chatTest = { messageRequests: [] };
    const realFetch = window.fetch.bind(window);
    const jsonResponse = (payload) => new Response(JSON.stringify(payload), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (url.includes('/rest/v1/appointments')) {
        return Promise.resolve(jsonResponse(${JSON.stringify([
          { id: 'appt-aaa', patient_id: 'p1', doctor_id: 'doc-dir-1', start_time: '2026-09-30T10:00:00Z', end_time: null, status: 'scheduled', consultation_type: 'telehealth', reason: 'Review my ECG', doctors: null },
          { id: 'appt-bbb', patient_id: 'p1', doctor_id: 'doc-dir-2', start_time: '2026-09-01T09:00:00Z', end_time: null, status: 'completed', consultation_type: null, reason: null, doctors: null },
        ])}));
      }
      if (url.includes('/rest/v1/messages')) {
        window.__chatTest.messageRequests.push(url);
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes('/rest/v1/rpc/list_doctor_directory')) {
        return Promise.resolve(jsonResponse(${JSON.stringify([
          { doctor_id: 'doc-dir-1', display_name: 'Dr. Sarah Khan', title: 'Cardiologist', specialty: 'Cardiology', hospital: null, about: null, rating: 4.9, experience_years: 12, is_available_today: false, next_available: null, slots: [], availability_date: null, booked_slots: [], avatar_url: null },
          { doctor_id: 'doc-dir-2', display_name: 'Dr. Marcus Lee', title: 'Cardiologist', specialty: 'Cardiology', hospital: null, about: null, rating: 4.7, experience_years: 8, is_available_today: false, next_available: null, slots: [], availability_date: null, booked_slots: [], avatar_url: null },
        ])}));
      }
      return realFetch(input, init);
    };
  })()`,
});

await send('Page.reload');
await sleep(3500);

const appReady = await pollFor("document.querySelectorAll('button').length > 3", 20000);
check('app booted to patient shell', appReady);

// --- 1. Open patient Appointments; both cards render Chat buttons ---
const navReady = await pollFor(`Boolean(document.querySelector('#nav-journey-appointments'))`, 20000);
check('patient navigation rendered', navReady === true);
await evaluate(`document.querySelector('#nav-journey-appointments').click()`);
const screenLoaded = await pollFor(
  `document.body.textContent.includes('Upcoming') && document.body.textContent.includes('Past')`,
  20000
);
check('appointments screen loaded (upcoming + past sections)', screenLoaded);
const buttonsPresent = await evaluate(
  `Boolean(document.querySelector('#appointment-chat-appt-aaa')) && Boolean(document.querySelector('#appointment-chat-appt-bbb'))`
);
check('Chat buttons exist for multiple appointments', buttonsPresent === true);

// --- 2. Click the SECOND appointment's Chat: chat opens for THAT appointment ---
await evaluate(`document.querySelector('#appointment-chat-appt-bbb').click()`);
const chatOpened = await pollFor(`document.body.textContent.includes('Appointment Chat')`, 15000);
check('chat screen opened from the card Chat button', chatOpened);
const askedForBbb = await evaluate(
  `window.__chatTest.messageRequests.some((u) => u.includes('appointment_id=eq.appt-bbb'))`
);
check('messages loaded for the CLICKED appointment (appt-bbb)', askedForBbb === true);
const didNotAskAaa = await evaluate(
  `!window.__chatTest.messageRequests.some((u) => u.includes('appointment_id=eq.appt-aaa'))`
);
check('no conversation was opened for the other appointment (appt-aaa)', didNotAskAaa === true);
const doctorNameShown = await pollFor(
  `document.body.textContent.includes('Dr. Marcus Lee')`,
  8000
);
check('chat header shows the correct doctor name (directory overlay)', doctorNameShown);

// --- 3. Normal Messages navigation: default conversation (most recent) applies ---
await evaluate(`document.querySelector('#nav-journey-messages').click()`);
const defaultSelected = await pollFor(
  `window.__chatTest.messageRequests.some((u) => u.includes('appointment_id=eq.appt-aaa'))`,
  15000
);
check('normal Messages nav opens the default (most recent) conversation', defaultSelected);

const chatErrors = consoleErrors.filter((e) => /chat|message/i.test(e ?? ''));
check('no chat-related console errors', chatErrors.length === 0, JSON.stringify(chatErrors.slice(0, 3)));

console.log(`\n[appointment-chat-runtime] ${PASS} passed, ${FAIL} failed`);
chrome.kill();
process.exit(FAIL === 0 ? 0 : 1);
