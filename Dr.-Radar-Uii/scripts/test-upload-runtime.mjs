// TEMPORARY — Phase 1A runtime test via Chrome DevTools Protocol (zero deps).
// Drives the real app at localhost:3000 and verifies the ECG upload pipeline:
//   1. MIT-BIH sample analysis still works (regression)
//   2. CSV upload -> filename + beat counts shown -> beat selection -> /analyze
//      on THAT beat -> persistence message -> waveform is the uploaded beat
//   3. PDF upload -> real error, no prediction, no fallback
// Prints pass/fail lines only. No tokens/secrets.
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:3000';
const DEBUG_PORT = 9224;
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
  '--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-cdp-upload-test',
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
    consoleErrors.push(msg.params.args?.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160));
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

// --- Boot the app with a completed local patient account (skips onboarding) ---
await send('Page.navigate', { url: APP });
await sleep(2500);
await evaluate('localStorage.clear(); "ok"');
await evaluate(`localStorage.setItem('dr_radar_account_v2', JSON.stringify({
  userId: 'USR-CDPTEST', firstName: 'Test', lastName: 'Patient', displayName: 'Test Patient',
  email: 'cdp-test@example.com', role: 'patient', profilePictureType: 'none', profilePicture: null,
  avatarUrl: '', dob: '1990-01-01', gender: 'Male', country: 'United States', language: 'English (US)',
  onboardingCompleted: true, profileCompleted: true, termsAccepted: true,
  notifications: { analysisResults: true, appointmentReminders: true, healthAlerts: true, researchUpdates: false, productUpdates: true },
  security: { twoFactorEnabled: false, activeSessionsCount: 1, lastPasswordChange: '2026-09-25' },
  createdAt: '2026-09-25',
})); "ok"`);
await evaluate(`localStorage.setItem('dr_radar_onboarding_step_v2', 'completed'); "ok"`);
await send('Page.reload');
await sleep(3500);

const appReady = await pollFor("document.querySelectorAll('button').length > 3", 20000);
check('app booted to patient shell', appReady);

// --- Navigate to the ECG workflow via the real UI ---
await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes('Take ECG Now'));
  if (btn) { btn.click(); return true; } return false;
})()`);
const ecgScreen = await pollFor(`Boolean(document.querySelector('[aria-label="ECG Acquisition"]'))`, 20000);
check('patient ECG screen reached', ecgScreen);

// --- 1. MIT-BIH regression: default sample analyzes through /analyze ---
const samplesLoaded = await pollFor(
  `[...document.querySelectorAll('[aria-label="ECG Acquisition"] button')].some((b) => b.textContent.includes('test-'))`,
  30000
);
check('MIT-BIH sample grid loaded from GET /samples', samplesLoaded);

const sampleAnalyze = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Analyze ECG/.test(b.textContent));
  if (!btn || btn.disabled) return 'missing-or-disabled';
  btn.click(); return 'clicked';
})()`);
check('MIT-BIH analyze clicked', sampleAnalyze === 'clicked', String(sampleAnalyze));
const sampleResult = await pollFor(
  `document.querySelector('[aria-label="Results"]')?.textContent.includes('confidence')`, 90000);
check('MIT-BIH sample produced /analyze result', sampleResult);
const sampleSaveNote = await evaluate(
  `document.querySelector('[aria-label="Results"]')?.textContent.includes('Not saved') ?? false`);
check('MIT-BIH save status surfaced (signed-out => Not saved)', sampleSaveNote);

// --- 2. Upload flow: CSV/TXT via POST /ecg/upload ---
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('button[role="tab"]')].find((b) => b.textContent.includes('Upload ECG CSV/TXT'));
  if (tab) tab.click(); return Boolean(tab);
})()`);
const uploadInput = await pollFor(`Boolean(document.getElementById('patient-ecg-upload-input'))`, 10000);
check('upload tab shows file picker', uploadInput);

const uploadCsv = await evaluate(`(() => {
  const values = Array.from({ length: 400 }, (_, i) => (0.001 * i).toFixed(4)).join(',');
  const file = new File([values], 'cdp_ecg.csv', { type: 'text/csv' });
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('patient-ecg-upload-input');
  input.files = dt.files;
  const attachedName = input.files[0]?.name ?? 'none'; // read BEFORE dispatch: the handler resets input.value
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return attachedName;
})()`);
check('CSV file attached to picker', uploadCsv === 'cdp_ecg.csv', String(uploadCsv));

// New staged flow: selection only stages the file; the explicit Analyze button runs everything.
const stagedShown = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('cdp_ecg.csv')
   && document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('not yet stored')`,
  15000
);
check('staged file summary shown before Analyze (filename + not-yet-stored status)', stagedShown);

const analyzeClick = await evaluate(`(() => {
  const section = document.querySelector('[aria-label="ECG Acquisition"]');
  const btn = [...section.querySelectorAll('button')].find((b) => /Analyze ECG/.test(b.textContent) && !b.disabled);
  if (!btn) return 'missing-or-disabled';
  btn.click(); return 'clicked';
})()`);
check('Analyze ECG button clicked (staged CSV)', analyzeClick === 'clicked', String(analyzeClick));

const uploadParsed = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('400 samples')
   && document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('2 × 187-value beat(s)')`,
  30000
);
check('sample/beat counts displayed after Analyze (400 samples -> 2 beats)', uploadParsed);

await evaluate(`(() => {
  const beatBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Beat 2'));
  if (beatBtn) { beatBtn.click(); return true; } return false;
})()`);
await sleep(400);
const beat2Preview = await evaluate(`(() => {
  const acquisition = document.querySelector('[aria-label="ECG Acquisition"]')?.textContent ?? '';
  const preview = document.querySelector('[aria-label="ECG Signal Preview"]')?.textContent ?? '';
  const svgLabel = document.querySelector('[aria-label="ECG Signal Preview"] svg[role="img"]')?.getAttribute('aria-label') ?? '';
  return {
    selectedInList: acquisition.includes('Beat 2'),
    previewNamesBeat2: preview.includes('Uploaded beat 2 of 2'),
    svgAria: svgLabel,
    stillUploadContext: preview.includes('cdp_ecg.csv'),
  };
})()`);
check('beat 2 selectable', beat2Preview?.selectedInList === true, JSON.stringify(beat2Preview));
check(
  'preview shows uploaded beat 2 waveform (not sample)',
  beat2Preview?.previewNamesBeat2 === true && beat2Preview?.stillUploadContext === true
    && beat2Preview.svgAria.includes('uploaded beat 2'),
  JSON.stringify(beat2Preview)
);

const beatAnalyze = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Analyze ECG|Re-run Analysis/.test(b.textContent));
  if (!btn || btn.disabled) return 'missing-or-disabled';
  btn.click(); return 'clicked';
})()`);
check('uploaded-beat analyze clicked', beatAnalyze === 'clicked', String(beatAnalyze));
const beatResult = await pollFor(
  `(() => {
    const results = document.querySelector('[aria-label="Results"]')?.textContent ?? '';
    return results.includes('confidence') && results.includes('Beat 2') === false ? results.includes('class id') : results.includes('class id');
  })() || document.querySelector('[aria-label="Results"]')?.textContent.includes('class id')`,
  90000
);
check('uploaded beat classified via /analyze', beatResult);
const uploadSaveNote = await evaluate(
  `document.querySelector('[aria-label="Results"]')?.textContent.includes('medical record') ?? false`);
check('persistence status shown for uploaded beat', uploadSaveNote);

// --- Phase 2A: storage attempted BEFORE parsing; signed-out => clear warning,
// no false "saved" claim, analysis still works (storage failure not blocking) ---
const storageWarning = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('Original file not saved')`,
  10000
);
check('signed-out CSV upload shows explicit NOT-saved warning', storageWarning);
const noFalseSaveClaim = await evaluate(
  `!document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('Original file stored:')`);
check('no false "original file stored" claim while signed out', noFalseSaveClaim);

// --- 3. Failure paths: PDF and malformed CSV -> real error, no prediction ---
const attachFile = (name, type, content) => `(() => {
  const file = new File([${JSON.stringify(content)}], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} });
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('patient-ecg-upload-input');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return input.files[0]?.name ?? 'none';
})()`;

await evaluate(attachFile('report.pdf', 'application/pdf', '%PDF-1.4 fake pdf'));
const pdfStaged = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('report.pdf')
   && document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('stores PDF only')`,
  15000
);
check('PDF staged with explicit stores-PDF-only button label', pdfStaged);
await evaluate(`(() => {
  const section = document.querySelector('[aria-label="ECG Acquisition"]');
  const btn = [...section.querySelectorAll('button')].find((b) => /Analyze ECG/.test(b.textContent) && !b.disabled);
  if (btn) btn.click();
  return Boolean(btn);
})()`);
const pdfError = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('Upload failed')
   || document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('PDF stored successfully')`,
  20000);
check('PDF click: storage attempted; error (signed-out) or stored-only message — never analysis', pdfError);
const pdfStorageError = await evaluate(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('could not be saved to your medical record storage') ?? false`);
check('signed-out PDF surfaces storage failure (never analyzed)', pdfStorageError);
const pdfIdleResults = await evaluate(
  `document.querySelector('[aria-label="Results"]')?.textContent.includes('Run an analysis') ?? false`);
check('no prediction shown after failed upload', pdfIdleResults);
const pdfAnalyzeDisabled = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Analyze ECG/.test(b.textContent));
  return btn ? btn.disabled : null;
})()`);
check('analyze disabled after failed upload (no MIT-BIH fallback)', pdfAnalyzeDisabled === true, String(pdfAnalyzeDisabled));

await evaluate(attachFile('bad.csv', 'text/csv', '1.0,2.0,not-a-number,4.0'));
const malformedError = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('Upload failed')
   && document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('Non-numeric')`,
  15000
);
check('malformed CSV shows backend 422 message', malformedError);

// --- Console errors observed ---
console.log('[console errors observed]', consoleErrors.length ? consoleErrors.slice(0, 10) : '(none)');

ws.close();
chrome.kill();
console.log(`RESULT: ${PASS} passed, ${FAIL} failed`);
if (failures.length) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
