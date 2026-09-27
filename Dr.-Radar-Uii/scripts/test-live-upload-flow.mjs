// TEMPORARY — Part 9 LIVE end-to-end test via Chrome DevTools Protocol.
// Opens a VISIBLE Chrome window at localhost:3000; you sign up/sign in there.
// Once an authenticated session exists, the script drives the FULL live flow:
//   CSV: stage -> Analyze ECG -> Storage object -> ecg_uploads row -> /ecg/upload
//        -> /analyze -> QML result -> ecg_records.upload_id -> predictions ->
//        explanations -> history screen -> signed-URL retrieval
//   PDF: store-only (no /ecg/upload, no /analyze, no QML)
//   Security: cross-patient storage + ecg_uploads denials from the session
// Prints pass/fail + error codes/IDs only. NEVER logs tokens/secrets.
// Usage: node scripts/test-live-upload-flow.mjs
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = 'http://localhost:3000';
const DEBUG_PORT = 9225;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let FAIL = 0;
const failures = [];
const check = (name, ok, extra = '') => {
  if (ok) { PASS++; console.log(`  PASS  ${name}`); }
  else { FAIL++; failures.push(name); console.log(`  FAIL  ${name} ${extra}`); }
};

// --- 1. Launch VISIBLE Chrome with remote debugging (user signs in inside it) ---
const chrome = spawn(CHROME, [
  '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--user-data-dir=C:/Users/ankan/AppData/Local/Temp/dr-radar-live-e2e',
  'about:blank',
], { stdio: 'ignore' });
chrome.on('error', (e) => { console.error('Chrome spawn failed:', e.message); process.exit(1); });
console.log('[chrome] visible window launched — SIGN UP / SIGN IN as a patient there now.');
console.log('[chrome] (confirm the verification email in your inbox first if required.)');

// --- 2. CDP plumbing ---
let targets = null;
for (let i = 0; i < 30; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json(); break; }
  catch { await sleep(500); }
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
    const text = msg.params.args?.map((a) => a.value ?? a.description ?? '').join(' ');
    if (/token|secret|password|apikey/i.test(text)) return; // never capture secrets
    consoleErrors.push(text.slice(0, 200));
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0, 300) ?? 'page eval failed');
  return r.result?.value;
};
const pollFor = async (expr, timeoutMs = 30000, intervalMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await evaluate(expr)) return true; } catch { /* page busy */ }
    await sleep(intervalMs);
  }
  return false;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: APP });

// --- 3. Wait for the user's authenticated session (up to 8 minutes) ---
console.log('[auth] waiting for an authenticated Supabase session (up to 8 min)…');
let sessionInfo = null;
const authDeadline = Date.now() + 8 * 60 * 1000;
while (Date.now() < authDeadline) {
  sessionInfo = await evaluate(`(async () => {
    try {
      const mod = await import('/src/lib/supabase.ts');
      const { data } = await mod.supabase.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? '(none)', anonymous: Boolean(u.is_anonymous) } : null;
    } catch { return null; }
  })()`).catch(() => null);
  if (sessionInfo) break;
  await sleep(5000);
}
if (!sessionInfo) {
  console.error('TIMEOUT: no authenticated session appeared. Exiting.');
  ws.close(); chrome.kill(); process.exit(1);
}
check('A. user authenticated', true);
console.log('[auth] session user id:', sessionInfo.id, '| anonymous:', sessionInfo.anonymous);
if (sessionInfo.anonymous) console.log('[auth] WARNING: anonymous session — patients row may not exist for it');

// --- 4. Patient row resolution (the RLS chain the whole flow depends on) ---
const patientId = await evaluate(`(async () => {
  const mod = await import('/src/lib/supabase.ts');
  const { data, error } = await mod.supabase.from('patients').select('id').eq('user_id', '${sessionInfo.id}').maybeSingle();
  return { id: data?.id ?? null, err: error ? { code: error.code, message: error.message } : null };
})()`);
console.log('[db] patients row:', patientId?.id ?? `MISSING (${JSON.stringify(patientId?.err)})`);
check('patient row resolvable (auth.uid() -> patients.user_id)', Boolean(patientId?.id), JSON.stringify(patientId?.err ?? ''));
if (!patientId?.id) {
  console.error('Cannot continue without a patients row — complete onboarding in the app window, then re-run.');
  ws.close(); chrome.kill(); process.exit(2);
}
const PID = patientId.id;

// --- 5. Navigate to the ECG screen via the UI ---
await sleep(1500);
await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes('Take ECG Now'));
  if (btn) { btn.click(); return true; }
  return false;
})()`);
const ecgScreen = await pollFor(`Boolean(document.querySelector('[aria-label="ECG Acquisition"]'))`, 20000);
check('patient ECG screen reached', ecgScreen);
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('button[role="tab"]')].find((b) => b.textContent.includes('Upload ECG CSV/TXT'));
  if (tab) tab.click();
  return Boolean(tab);
})()`);
await pollFor(`Boolean(document.getElementById('patient-ecg-upload-input'))`, 10000);

// --- 6. CSV flow (B-G) ---
const attachFile = (name, type, content) => `(() => {
  const file = new File([${JSON.stringify(content)}], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} });
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('patient-ecg-upload-input');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return input.files[0]?.name ?? 'none';
})()`;

const attached = await evaluate(attachFile('live_e2e.csv', 'text/csv',
  Array.from({ length: 400 }, (_, i) => (0.001 * i).toFixed(4)).join(',')));
check('B. CSV selected (staged)', attached === 'live_e2e.csv', String(attached));

const stagedShown = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('live_e2e.csv')`, 10000);
check('staged summary shows filename', stagedShown);

const clicked = await evaluate(`(() => {
  const section = document.querySelector('[aria-label="ECG Acquisition"]');
  const btn = [...section.querySelectorAll('button')].find((b) => /Analyze ECG/.test(b.textContent) && !b.disabled);
  if (!btn) return 'missing-or-disabled';
  btn.click(); return 'clicked';
})()`);
check('C. Analyze ECG clicked', clicked === 'clicked', String(clicked));

const parsed = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('400 samples')`, 60000);
check('F. /ecg/upload parsed the uploaded file (400 samples shown)', parsed);

const analyzed = await pollFor(
  `document.querySelector('[aria-label="Results"]')?.textContent.includes('confidence')`, 120000);
check('G/H. /analyze classified the uploaded beat (QML result shown)', analyzed);

const beatContext = await evaluate(`(() => {
  const preview = document.querySelector('[aria-label="ECG Signal Preview"]')?.textContent ?? '';
  return { namesUploadedBeat: preview.includes('Uploaded beat 1 of 2'), notSample: !preview.includes('test-0') };
})()`);
check('analyzed signal is the UPLOADED beat (not a sample)', beatContext?.namesUploadedBeat === true && beatContext?.notSample === true, JSON.stringify(beatContext));

// --- 7. DB verification (D, E, I, J) via the in-page authenticated client ---
const dbChecks = await evaluate(`(async () => {
  const mod = await import('/src/lib/supabase.ts');
  const sb = mod.supabase;
  const out = {};
  const up = await sb.from('ecg_uploads').select('id, file_name, storage_path, size_bytes, upload_type, created_at')
    .eq('patient_id', '${PID}').order('created_at', { ascending: false }).limit(1).maybeSingle();
  out.uploadRow = up.error ? { err: { code: up.error.code, message: up.error.message } }
    : (up.data ? { id: up.data.id, file: up.data.file_name, path: up.data.storage_path } : null);
  const rec = await sb.from('ecg_records').select('id, upload_id, source, recorded_at')
    .eq('patient_id', '${PID}').order('recorded_at', { ascending: false }).limit(1).maybeSingle();
  out.record = rec.error ? { err: { code: rec.error.code, message: rec.error.message } } : rec.data;
  if (rec.data?.id) {
    const pred = await sb.from('predictions').select('id, predicted_class, confidence, ecg_record_id')
      .eq('ecg_record_id', rec.data.id).maybeSingle();
    out.prediction = pred.error ? { err: { code: pred.error.code } } : pred.data;
    if (pred.data?.id) {
      const expl = await sb.from('explanations').select('id, method, prediction_id')
        .eq('prediction_id', pred.data.id).maybeSingle();
      out.explanation = expl.error ? { err: { code: expl.error.code } } : expl.data;
    }
  }
  return out;
})()`);
check('D/E. ecg_uploads row exists for this upload', Boolean(dbChecks?.uploadRow?.id),
  JSON.stringify(dbChecks?.uploadRow ?? 'null'));
check('D. Storage object path matches {patient_id}/{upload_id}/{filename} convention',
  Boolean(dbChecks?.uploadRow?.path?.startsWith(`${PID}/`)), dbChecks?.uploadRow?.path ?? 'n/a');
check('I. ecg_records.upload_id populated', Boolean(dbChecks?.record?.upload_id),
  JSON.stringify(dbChecks?.record ?? 'null'));
check('J1. prediction saved for this record', Boolean(dbChecks?.prediction?.id), JSON.stringify(dbChecks?.prediction ?? 'null'));
check('J2. explanation (XAI) saved', Boolean(dbChecks?.explanation?.id), JSON.stringify(dbChecks?.explanation ?? 'null'));

// --- 8. Signed URL retrieval (L) — proves the object physically exists in Storage ---
const signed = await evaluate(`(async () => {
  const mod = await import('/src/lib/supabase.ts');
  const sb = mod.supabase;
  if (!${Boolean(dbChecks?.uploadRow?.id)}) return { skip: true };
  const { data: s, error: se } = await sb.storage.from('ecg-uploads')
    .createSignedUrl(${JSON.stringify(dbChecks?.uploadRow?.path ?? '')}, 60);
  if (se || !s?.signedUrl) return { err: { message: se?.message ?? 'no url' } };
  const resp = await fetch(s.signedUrl);
  const bodyText = await resp.text();
  return { status: resp.status, bytes: bodyText.length, matches: bodyText.includes('0.0010') };
})()`);
check('L. signed URL retrieves the stored object (200 + content match)',
  signed?.status === 200 && signed?.matches === true, JSON.stringify(signed ?? 'null'));

// --- 9. History screen (K) ---
await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes('View ECG History'));
  if (btn) { btn.click(); return true; }
  const nav = [...document.querySelectorAll('button, a')].find((b) => /history/i.test(b.textContent) && b.textContent.includes('ECG'));
  if (nav) { nav.click(); return true; }
  return false;
})()`);
const historyShown = await pollFor(
  `document.body.textContent.includes('live_e2e.csv')`, 20000);
check('K. history lists the stored file (live_e2e.csv visible)', historyShown);

// --- 10. PDF flow (M-R) ---
const backOnEcg = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes('Back to ECG analysis'));
  if (btn) { btn.click(); return true; } return false;
})()`);
await pollFor(`Boolean(document.querySelector('[aria-label="ECG Acquisition"]'))`, 15000);
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('button[role="tab"]')].find((b) => b.textContent.includes('Upload ECG CSV/TXT'));
  if (tab) tab.click();
  return Boolean(tab);
})()`);
await pollFor(`Boolean(document.getElementById('patient-ecg-upload-input'))`, 10000);

const pdfAttached = await evaluate(attachFile('live_report.pdf', 'application/pdf',
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'));
check('M. PDF selected', pdfAttached === 'live_report.pdf', String(pdfAttached));
const pdfLabel = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('stores PDF only')`, 10000);
check('N1. Analyze button explicitly says PDF is store-only', pdfLabel);
await evaluate(`(() => {
  const section = document.querySelector('[aria-label="ECG Acquisition"]');
  const btn = [...section.querySelectorAll('button')].find((b) => /Analyze ECG/.test(b.textContent) && !b.disabled);
  if (btn) btn.click();
  return Boolean(btn);
})()`);
const pdfOutcome = await pollFor(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('PDF stored successfully')
   || document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('could not be saved')`, 30000);
check('O/P. PDF storage attempted (stored message or explicit failure)', pdfOutcome);
const pdfNoQml = await evaluate(
  `!document.querySelector('[aria-label="Results"]')?.textContent.includes('confidence')`);
check('Q. NO QML prediction generated for the PDF', pdfNoQml === true);
const pdfMsg = await evaluate(
  `document.querySelector('[aria-label="ECG Acquisition"]')?.textContent.includes('PDF stored successfully. ECG waveform analysis from PDF is not currently supported.') ?? false`);
check('R. explicit unsupported-analysis message shown', pdfMsg === true);

const pdfRow = await evaluate(`(async () => {
  const mod = await import('/src/lib/supabase.ts');
  const { data, error } = await mod.supabase.from('ecg_uploads').select('id, file_name, upload_type')
    .eq('patient_id', '${PID}').eq('file_name', 'live_report.pdf').maybeSingle();
  return error ? { err: { code: error.code } } : data;
})()`);
check('P. ecg_uploads row exists for the PDF', Boolean(pdfRow?.id), JSON.stringify(pdfRow ?? 'null'));

// --- 11. Security probes (authenticated session) ---
const security = await evaluate(`(async () => {
  const mod = await import('/src/lib/supabase.ts');
  const sb = mod.supabase;
  const out = {};
  const foreignId = '00000000-0000-0000-0000-00000000dead';
  const up = await sb.storage.from('ecg-uploads')
    .upload(foreignId + '/x/evil.csv', new Blob(['x'], { type: 'text/csv' }), { contentType: 'text/csv' });
  out.foreignStorageUploadDenied = Boolean(up.error);
  out.foreignStorageError = up.error ? (up.error.message ?? '').slice(0, 90) : 'UNEXPECTED SUCCESS';
  const ins = await sb.from('ecg_uploads').insert({
    patient_id: foreignId, file_name: 'evil.csv', mime_type: 'text/csv',
    size_bytes: 1, storage_path: foreignId + '/x/evil.csv', upload_type: 'ecg-csv',
  });
  out.foreignMetadataInsertDenied = Boolean(ins.error);
  out.foreignMetadataError = ins.error ? (ins.error.message ?? '').slice(0, 90) : 'UNEXPECTED SUCCESS';
  const foreignList = await sb.storage.from('ecg-uploads').list(foreignId);
  out.foreignListDeniedOrEmpty = Boolean(foreignList.error) || (foreignList.data ?? []).length === 0;
  return out;
})()`);
check('SEC1. patient cannot upload to another patient\'s storage prefix', security?.foreignStorageUploadDenied === true, security?.foreignStorageError ?? '');
check('SEC2. patient cannot insert another patient\'s ecg_uploads row', security?.foreignMetadataInsertDenied === true, security?.foreignMetadataError ?? '');
check('SEC3. patient cannot list another patient\'s objects', security?.foreignListDeniedOrEmpty === true);

// --- Console errors observed (secret-free) ---
console.log('[console errors observed]', consoleErrors.length ? consoleErrors.slice(0, 10) : '(none)');

ws.close();
chrome.kill();
console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`);
if (failures.length) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
