// TEMPORARY DIAGNOSTIC — unauthenticated probes. Error signatures distinguish:
//   bucket missing  vs  RLS denying  vs  table missing  vs  table+RLS working.
// Prints only HTTP statuses and error codes. No secrets.
import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` }; // anon JWT

// --- 1. ecg_uploads table: missing => PGRST205; present+RLS => 200 [] or 42501 ---
{
  const r = await fetch(`${url}/rest/v1/ecg_uploads?select=id&limit=1`, { headers });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch { /* ignore */ }
  console.log(`[rest] GET ecg_uploads => HTTP ${r.status}`, typeof body === 'string' ? text.slice(0, 140) : JSON.stringify(body)?.slice(0, 200));
}

// --- 2. storage upload as anon: distinguishes bucket existence vs RLS ---
{
  const form = new FormData();
  form.append('x', 'y');
  const r = await fetch(`${url}/storage/v1/object/ecg-uploads/anon-probe/test.csv`, {
    method: 'POST', headers, body: JSON.stringify({ x: 1 }), // JSON body; content type mismatches are fine for the probe
  });
  const text = await r.text();
  console.log(`[storage] POST object (anon) => HTTP ${r.status}`, text.slice(0, 220));
  // 404 "Bucket not found"        => bucket missing
  // 400 "new row violates ... RLS" => bucket EXISTS, policy denies anon (expected/healthy)
  // 403                            => policy denies anon (expected/healthy)
}

// --- 3. bucket metadata as anon (Supabase returns 400/403 for private buckets) ---
{
  const r = await fetch(`${url}/storage/v1/bucket/ecg-uploads`, { headers });
  const text = await r.text();
  console.log(`[storage] GET bucket meta (anon) => HTTP ${r.status}`, text.slice(0, 200));
}

// --- 4. signed-url creation as anon ---
{
  const r = await fetch(`${url}/storage/v1/object/sign/ecg-uploads/anon-probe/test.csv`, {
    method: 'POST', headers, body: JSON.stringify({ expiresIn: 60 }),
  });
  const text = await r.text();
  console.log(`[storage] POST sign (anon) => HTTP ${r.status}`, text.slice(0, 200));
}
console.log('[done] anon probes complete');
