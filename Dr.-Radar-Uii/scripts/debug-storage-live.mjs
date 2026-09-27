// TEMPORARY DIAGNOSTIC — live Supabase Storage + ecg_uploads path (Part 1 audit).
// Reproduces the EXACT browser flow: publishable key + real authenticated session.
// Prints only error codes/messages/booleans/UUIDs. NEVER prints tokens/secrets.
// Usage: node scripts/debug-storage-live.mjs
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
console.log('[env] Supabase host:', new URL(url).host, '| publishable key present:', Boolean(key));

const supabase = createClient(url, key);

// Deterministic test patient account (reused across runs; test-only email).
const TEST_EMAIL = 'buffy.storage.diag@drradar-test.com';
const TEST_PASSWORD = 'Buffy-Storage-2026!x';

const errOf = (e) => (e ? { code: e.code ?? null, status: e.status ?? null, message: e.message } : null);

// --- 1. Authenticate (password sign-in → anonymous session → email signUp) ---
// An anonymous Supabase session is still a REAL authenticated JWT (role=authenticated
// with auth.uid()), which is exactly what the storage/RLS policies evaluate.
console.log('[auth] signing in test patient…');
let authUser = null;
{
  const { data, error } = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (!error && data?.user) {
    authUser = data.user;
    console.log('[auth] signed in. user id:', authUser.id, '| is_anonymous:', authUser.is_anonymous ?? null);
  } else {
    console.log('[auth] password sign-in failed:', errOf(error));
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (!anonError && anonData?.session?.user) {
      authUser = anonData.session.user;
      console.log('[auth] anonymous session OK (authenticated JWT). user id:', authUser.id, '| is_anonymous:', authUser.is_anonymous ?? null);
    } else {
      console.log('[auth] anonymous sign-in unavailable:', errOf(anonError));
      console.log('[auth] trying signUp (needs Confirm email = OFF for a session)…');
      const { data: signUp, error: signUpError } = await supabase.auth.signUp({ email: TEST_EMAIL, password: TEST_PASSWORD });
      if (signUpError) {
        console.error('[auth] signUp FAILED:', errOf(signUpError));
        process.exit(2);
      }
      authUser = signUp?.user ?? null;
      if (!signUp?.session) {
        console.error('[auth] signUp OK but NO session (email confirmation enabled). Cannot test authenticated path.');
        process.exit(3);
      }
      console.log('[auth] signed up + session. user id:', authUser.id);
    }
  }
}
if (!authUser) { console.error('[auth] no user'); process.exit(3); }

// --- 2. Own users/patients rows (what the real app provisions) ---
const { data: ownUser, error: ownUserErr } = await supabase.from('users').select('id, role').eq('id', authUser.id).maybeSingle();
console.log('[db] public.users own row exists:', Boolean(ownUser), ownUserErr ? `err: ${JSON.stringify(errOf(ownUserErr))}` : '');

let patientId = null;
{
  const { data, error } = await supabase.from('patients').select('id').eq('user_id', authUser.id).maybeSingle();
  if (error) console.log('[db] public.patients select err:', JSON.stringify(errOf(error)));
  else patientId = data?.id ?? null;
  console.log('[db] public.patients own row:', patientId ?? 'MISSING');
}

if (!ownUser || !patientId) {
  console.log('[db] provisioning missing rows (same as app onboarding)…');
  if (!ownUser) {
    const { error } = await supabase.from('users').upsert({
      id: authUser.id, email: authUser.email ?? TEST_EMAIL, role: 'patient',
      first_name: 'Buffy', last_name: 'StorageDiag', display_name: 'Buffy StorageDiag',
      password_hash: 'supabase-auth-managed', onboarding_completed: true, profile_completed: true,
    }, { onConflict: 'id' });
    console.log('[db] users upsert:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK');
  }
  if (!patientId) {
    const { data, error } = await supabase.from('patients').upsert({ user_id: authUser.id }, { onConflict: 'user_id' }).select('id').single();
    console.log('[db] patients upsert:', error ? `FAILED ${JSON.stringify(errOf(error))}` : `OK id=${data?.id}`);
    patientId = data?.id ?? patientId;
  }
}
if (!patientId) {
  console.error('FATAL: no patients row — RLS blocked provisioning. This alone breaks Storage uploads (policy resolves auth.uid() → patients.user_id).');
  process.exit(4);
}

// --- 3. Does the ecg_uploads table exist live? (009 applied?) ---
{
  const { error } = await supabase.from('ecg_uploads').select('id').limit(1);
  if (error) console.log('[db] ecg_uploads probe:', JSON.stringify(errOf(error)), '<== 42P01/PGRST205 here means migration 009 was NEVER applied to the live DB');
  else console.log('[db] ecg_uploads table reachable: OK');
}

// --- 4. Bucket metadata (visibility/limits as the user can see them) ---
{
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) console.log('[storage] listBuckets err:', JSON.stringify(errOf(error)));
  else {
    const b = buckets?.find((x) => x.id === 'ecg-uploads');
    console.log('[storage] ecg-uploads bucket visible:', Boolean(b), b ? { public: b.public, file_size_limit: b.file_size_limit, allowed_mime_types: b.allowed_mime_types } : '(not listed — may still exist but be hidden from RLS)');
  }
}

// --- 5. THE CORE PROBE: upload exactly like the app does ---
const diagId = crypto.randomUUID();
const ownPath = `${patientId}/${diagId}/diag-ecg.csv`;
const csvBody = '0.1,0.2,0.3,0.4,0.5';
console.log('[storage] uploading own-scoped path:', ownPath);
{
  const { error } = await supabase.storage
    .from('ecg-uploads')
    .upload(ownPath, new Blob([csvBody], { type: 'text/csv' }), { contentType: 'text/csv', upsert: false });
  if (error) {
    console.error('[storage] UPLOAD FAILED:', JSON.stringify({ status: error.status ?? null, error: error.error ?? null, message: error.message, statusCode: error.statusCode ?? null }));
    console.log('    ^ 403 "row-level security" => storage.objects INSERT policy missing/wrong live');
    console.log('    ^ "Invalid MIME" => bucket MIME whitelist mismatch');
    console.log('    ^ "not found" => bucket missing');
  } else {
    console.log('[storage] own-path upload: OK (object persisted)');
  }
}

// --- 6. Signed URL (SELECT policy check) ---
if (patientId) {
  const { data: signed, error } = await supabase.storage.from('ecg-uploads').createSignedUrl(ownPath, 60);
  console.log('[storage] signed URL for own object:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK (SELECT policy works)');
}

// --- 7. Negative control: another patient's prefix must be denied ---
{
  const foreignId = '00000000-0000-0000-0000-00000000dead';
  const { error } = await supabase.storage
    .from('ecg-uploads')
    .upload(`${foreignId}/${diagId}/evil.csv`, new Blob(['x'], { type: 'text/csv' }), { contentType: 'text/csv', upsert: false });
  console.log('[security] foreign-prefix upload rejected:', Boolean(error), error ? `(${error.status ?? ''} ${error.message.slice(0, 80)})` : 'UNEXPECTEDLY SUCCEEDED — policy too permissive!');
}

// --- 8. Metadata insert probe (ecg_uploads INSERT policy) ---
{
  const { error } = await supabase.from('ecg_uploads').insert({
    patient_id: patientId,
    file_name: 'diag-ecg.csv',
    mime_type: 'text/csv',
    size_bytes: csvBody.length,
    storage_path: ownPath,
    upload_type: 'ecg-csv',
  });
  console.log('[db] ecg_uploads INSERT:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK');
}

// --- 9. Cleanup: remove probe object + any metadata row ---
{
  const { error } = await supabase.storage.from('ecg-uploads').remove([ownPath]);
  console.log('[cleanup] object remove:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK');
  const { error: delErr } = await supabase.from('ecg_uploads').delete().eq('storage_path', ownPath);
  console.log('[cleanup] metadata delete:', delErr ? `FAILED ${JSON.stringify(errOf(delErr))}` : 'OK');
}

console.log('\n[done] live diagnostic complete. user:', authUser.id, 'patient:', patientId);
