// TEMPORARY — Phase 2 diagnostics: live column existence + RLS state via anon probes.
// Prints only schema facts and error codes/messages. No secrets.
import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const get = async (path) => {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* ignore */ }
  return { status: r.status, parsed, text };
};

// --- 1. Column-existence oracles: column resolution happens BEFORE RLS, so a
//        missing column yields PGRST204 even for anon. ---
console.log('=== LIVE COLUMN EXISTENCE (anon select oracle) ===');
for (const [table, cols] of [
  ['users', ['id', 'email', 'password_hash', 'display_name', 'first_name', 'role', 'avatar_url']],
  ['patients', ['user_id', 'dob', 'gender', 'avatar_url']],
  ['doctors', ['user_id', 'title', 'specialty', 'hospital']],
]) {
  for (const col of cols) {
    const { status, parsed } = await get(`${table}?select=${col}&limit=0`);
    const msg = parsed?.message ?? '';
    if (status === 200) console.log(`[${table}.${col}] EXISTS`);
    else if (parsed?.code === 'PGRST204' || /Could not find/i.test(msg)) {
      console.log(`[${table}.${col}] MISSING IN LIVE DB  <== ${msg}`);
    } else {
      console.log(`[${table}.${col}] inconclusive (HTTP ${status}): ${parsed?.code ?? ''} ${msg.slice(0, 120)}`);
    }
  }
}

// --- 2. Anon SELECT on whole tables: RLS on -> 42501; RLS off -> 200 (exposure!) ---
console.log('\n=== ANON SELECT (RLS state) ===');
for (const table of ['users', 'patients', 'doctors']) {
  const { status, parsed } = await get(`${table}?limit=1`);
  if (status === 200) {
    console.log(`[${table}] HTTP 200 — ROWS VISIBLE TO ANON! (RLS missing/disabled) count: ${Array.isArray(parsed) ? parsed.length : '?'}`);
  } else {
    console.log(`[${table}] HTTP ${status} — blocked (RLS likely on): ${parsed?.code ?? ''} ${String(parsed?.message ?? '').slice(0, 100)}`);
  }
}

// --- 3. Anon INSERT probes: expect 42501 row-level-security violation ---
console.log('\n=== ANON INSERT PROBES (expect 42501 if RLS enabled) ===');
const probeInsert = async (table, body) => {
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
  console.log(`[anon-insert:${table}] HTTP ${r.status}`, parsed ?? text.slice(0, 200));
};

await probeInsert('users', {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'anon-probe@drradar-test.com', role: 'patient',
  first_name: 'A', last_name: 'B', display_name: 'AB', password_hash: 'x',
});
await probeInsert('patients', { user_id: '11111111-1111-1111-1111-111111111111' });
await probeInsert('doctors', { user_id: '11111111-1111-1111-1111-111111111111', title: 'T', specialty: 'S' });

console.log('\n[done] phase 2 complete');
