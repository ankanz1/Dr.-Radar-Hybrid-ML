// TEMPORARY DIAGNOSTIC SCRIPT — live Supabase diagnosis (Part A–D).
// Prints only error codes/messages/hints, booleans, and user IDs. No secrets/tokens.
// Usage: node scripts/debug-supabase.mjs [--authorize]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const wantAuthorize = process.argv.includes('--authorize');

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
console.log('[env] Supabase URL host:', new URL(url).host, '| publishable key present:', Boolean(key));

const supabase = createClient(url, key);

// --- 1. Public auth settings (booleans only) ---
const settingsRes = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
const settings = await settingsRes.json().catch(() => null);
if (settings) {
  console.log('[auth/settings] providers:', {
    google: settings.external?.google,
    facebook: settings.external?.facebook,
    email: settings.external?.email,
  });
  console.log('[auth/settings] mailer_autoconfirm:', settings.mailer_autoconfirm);
  console.log('[auth/settings] anonymous sign-ins enabled:', settings.external?.anonymous_users ?? 'unknown');
} else {
  console.log('[auth/settings] HTTP', settingsRes.status, '— could not read settings');
}

// --- 2. Probe OAuth /authorize legs (no browser, no credentials needed) ---
if (wantAuthorize) {
  for (const provider of ['google', 'facebook']) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: 'http://localhost:3000' },
    });
    if (error) {
      console.error(`[oauth:${provider}] signInWithOAuth returned error:`, {
        code: error.code ?? null, message: error.message, status: error.status ?? null,
      });
      continue;
    }
    const authorizeUrl = data?.url;
    if (!authorizeUrl) { console.error(`[oauth:${provider}] no url returned`); continue; }
    try {
      // Manual redirect walk: log each hop so we can see if Supabase bounces us to an error page
      let current = authorizeUrl;
      for (let hop = 0; hop < 6; hop++) {
        const res = await fetch(current, { redirect: 'manual' });
        const loc = res.headers.get('location');
        console.log(`[oauth:${provider}] hop ${hop}: HTTP ${res.status} ${current.slice(0, 90)}...`);
        if (loc) {
          console.log(`[oauth:${provider}]   → redirect: ${loc.slice(0, 140)}`);
          if (/error|denied|invalid|unsupported/i.test(loc)) {
            console.error(`[oauth:${provider}] AUTHORIZE-LEG ERROR DETECTED in redirect:`, loc.slice(0, 200));
          }
          current = new URL(loc, current).toString();
          continue;
        }
        const body = await res.text();
        const looksLikeGoogle = /accounts\.google\.com|ServiceLogin|facebook\.com\/login/i.test(body) || /google|facebook/i.test(current);
        console.log(`[oauth:${provider}] final: HTTP ${res.status}, provider login page reached: ${looksLikeGoogle}, body bytes: ${body.length}`);
        break;
      }
    } catch (e) {
      console.error(`[oauth:${provider}] probe failed:`, e?.message ?? e);
    }
  }
  console.log('[oauth] authorize-leg probe complete');
}

// --- 3. Mint a real authenticated session for RLS/upsert tests ---
const testEmail = `buffy.diag.7f3a@drradar-test.com`;
const testPassword = 'Buffy-Diag-2026!x';
console.log('[auth] attempting anonymous sign-in for RLS test...');
let authUser = null;
{
  const { data, error } = await supabase.auth.signInAnonymously();
  if (!error && data?.session?.user) {
    authUser = data.session.user;
    console.log('[auth] anonymous session OK. user id:', authUser.id, '| email:', authUser.email ?? '(none)');
  } else {
    console.log('[auth] anonymous sign-in unavailable:', {
      code: error?.code ?? null, message: error?.message ?? null,
    });
  }
}

if (!authUser) {
  console.log('[auth] falling back to email signUp (needs Confirm email = OFF to get a session)...');
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email: testEmail, password: testPassword,
  });
  if (signUpError) {
    console.error('[auth] signUp FAILED:', {
      code: signUpError.code ?? null, message: signUpError.message, status: signUpError.status ?? null,
    });
    process.exit(2);
  }
  authUser = signUp?.user;
  if (!signUp?.session) {
    console.error('[auth] signUp OK but NO session (email confirmation enabled) — cannot run authenticated upsert tests.');
    console.error('      Options: temporarily set Confirm email = OFF in Supabase dashboard, or use a verified test account.');
    process.exit(3);
  }
  console.log('[auth] email session OK. user id:', authUser.id);
}

// Attach the session for table ops happens automatically via the client.
const role = 'patient';
const logOpError = (op, err) => console.error(`[op:${op}] FAILED`, {
  code: err?.code ?? null, message: err?.message ?? null,
  details: err?.details ?? null, hint: err?.hint ?? null,
});
const logOpOk = (op, extra) => console.log(`[op:${op}] OK`, extra ?? '');

// --- 4. Replay EXACT public.users profile-save from App.tsx ---
const { error: usersError } = await supabase.from('users').upsert({
  id: authUser.id,
  email: authUser.email ?? testEmail,
  role,
  first_name: 'Buffy',
  last_name: 'Diagnostic',
  display_name: 'Buffy Diagnostic',
  password_hash: 'supabase-auth-managed',
  avatar_url: null,
  onboarding_completed: true,
  profile_completed: true,
}, { onConflict: 'id' });
if (usersError) logOpError('public.users upsert (current App payload)', usersError);
else logOpOk('public.users upsert (current App payload)', { id: authUser.id, role });

// --- 4b. users upsert WITHOUT password_hash (detect column absence) ---
const { error: usersNoPwError } = await supabase.from('users').upsert({
  id: authUser.id,
  email: authUser.email ?? testEmail,
  role,
  first_name: 'Buffy',
  last_name: 'Diagnostic',
  display_name: 'Buffy Diagnostic',
  onboarding_completed: true,
}, { onConflict: 'id' });
if (usersNoPwError) logOpError('public.users upsert (WITHOUT password_hash)', usersNoPwError);
else logOpOk('public.users upsert (WITHOUT password_hash)', { id: authUser.id });

// --- 5. patients upsert ---
const { error: patientsError } = await supabase.from('patients')
  .upsert({ user_id: authUser.id }, { onConflict: 'user_id' });
if (patientsError) logOpError('public.patients upsert', patientsError);
else logOpOk('public.patients upsert', { user_id: authUser.id });

// --- 6. doctors upsert (old minimal payload — expect NOT NULL violation) ---
const { error: doctorsError } = await supabase.from('doctors')
  .upsert({ user_id: authUser.id }, { onConflict: 'user_id' });
if (doctorsError) logOpError('public.doctors upsert (old minimal payload)', doctorsError);
else logOpOk('public.doctors upsert (old minimal payload)', { user_id: authUser.id });

// --- 7. doctors upsert (full payload) ---
const { error: doctorsFullError } = await supabase.from('doctors').upsert({
  user_id: authUser.id, title: 'Diagnostic Fellow', specialty: 'Cardiology', hospital: 'Buffy Test',
}, { onConflict: 'user_id' });
if (doctorsFullError) logOpError('public.doctors upsert (full payload)', doctorsFullError);
else logOpOk('public.doctors upsert (full payload)', { user_id: authUser.id });

// --- 8. RLS negative control: another user's id must be rejected ---
const { error: rlsError } = await supabase.from('users').upsert({
  id: '00000000-0000-0000-0000-000000000000',
  email: 'buffy-rls-control@drradar-test.com',
  role: 'patient',
  first_name: 'RLS', last_name: 'Control', display_name: 'RLS Control', password_hash: 'x',
}, { onConflict: 'id' });
if (rlsError) console.log('[op:RLS negative control] correctly rejected:', {
  code: rlsError.code ?? null, message: rlsError.message,
});
else console.error('[op:RLS negative control] UNEXPECTEDLY SUCCEEDED — RLS may be missing on public.users!');

console.log('[done] diagnostic run complete. Test user id:', authUser.id);
