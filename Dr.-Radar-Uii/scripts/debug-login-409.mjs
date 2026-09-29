// TEMPORARY DIAGNOSTIC — production login 409 reproduction (read-mostly).
// Reproduces the EXACT login-time sync flow against the LIVE project with a
// fresh throwaway auth user (same drradar-test.com pattern as debug-supabase.mjs)
// and prints the full PostgREST error payload (code/message/details/hint).
// No schema changes, no RLS changes, no secrets printed. The test user remains
// in auth.users (deleting it needs a service role — same as existing scripts).
// Usage: node scripts/debug-login-409.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('FATAL: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing in .env.local');
  process.exit(1);
}
console.log('[env] project:', new URL(url).host);

const supabase = createClient(url, key);
const errOf = (e) => (e ? { code: e.code ?? null, status: e.status ?? null, message: e.message, details: e.details ?? null, hint: e.hint ?? null } : null);

// --- 1. Auth settings (booleans only) ---
{
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  const s = await res.json().catch(() => null);
  console.log('[auth/settings] mailer_autoconfirm:', s?.mailer_autoconfirm, '| email provider:', s?.external?.email);
}

// --- 2. Fresh auth user (mimics production signUp → confirmed → signIn) ---
const stamp = Date.now().toString(36);
const testEmail = `buffy.409.${stamp}@drradar-test.com`;
const testPassword = 'Buffy-409-Diag-2026!x';
console.log('[auth] signing up fresh test user:', testEmail);
{
  const { data, error } = await supabase.auth.signUp({ email: testEmail, password: testPassword });
  if (error) {
    console.error('[auth] signUp FAILED:', JSON.stringify(errOf(error)));
    process.exit(2);
  }
  if (!data.session) {
    console.error('[auth] signUp OK but no session (email confirmation required) — cannot reproduce login-time flow.');
    process.exit(3);
  }
  console.log('[auth] session OK. user id:', data.user.id, '| email:', data.user.email);
}

// Sign out, then sign back in EXACTLY like a returning user (login screen path).
await supabase.auth.signOut();
{
  const { data, error } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (error || !data.session) {
    console.error('[auth] signInWithPassword FAILED:', JSON.stringify(errOf(error)));
    process.exit(4);
  }
  console.log('[auth] signed in as returning user. id:', data.user.id);
}

const authUser = (await supabase.auth.getSession()).data.session.user;

// --- 3. EXACT syncAccountProvisioning SELECT ---
{
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('id, onboarding_completed')
    .eq('id', authUser.id)
    .maybeSingle();
  console.log('[sync] users select → existing:', JSON.stringify(existing), '| error:', JSON.stringify(errOf(selectError)));
}

// --- 4. EXACT syncAccountProvisioning INSERT path (upsert onConflict id) ---
{
  const { error } = await supabase.from('users').upsert(
    {
      id: authUser.id,
      email: authUser.email,
      role: 'patient',
      first_name: 'Buffy',
      last_name: 'Diag409',
      display_name: 'Buffy Diag409',
      password_hash: 'supabase-auth-managed',
      onboarding_completed: false,
      profile_completed: false,
    },
    { onConflict: 'id' }
  );
  if (error) console.error('[sync] users upsert (login-time insert path) FAILED:', JSON.stringify(errOf(error)));
  else console.log('[sync] users upsert (login-time insert path) OK');
}

// --- 5. Row visible now? + patients upsert ---
{
  const { data, error } = await supabase.from('users').select('id, onboarding_completed').eq('id', authUser.id).maybeSingle();
  console.log('[sync] users row after upsert:', JSON.stringify(data), '| err:', JSON.stringify(errOf(error)));
  const { error: pErr } = await supabase.from('patients').upsert({ user_id: authUser.id }, { onConflict: 'user_id' });
  console.log('[sync] patients upsert:', pErr ? `FAILED ${JSON.stringify(errOf(pErr))}` : 'OK');
  const rpc = await supabase.rpc('ensure_patient_profile');
  console.log('[sync] rpc ensure_patient_profile:', rpc.error ? `FAILED ${JSON.stringify(errOf(rpc.error))}` : `OK id=${rpc.data}`);
}

console.log('[done] test user id:', authUser.id, '(left in auth.users — same as existing diag scripts)');
process.exit(0);
