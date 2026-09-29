// TEMPORARY DIAGNOSTIC — replay provisionAccount's exact write sequence for a
// FRESH signup: users upsert → ensure_patient_profile RPC → patients upsert
// (dob/gender/country/language/avatar_url) → health_profiles upsert, using the
// same data the onboarding flow sends (Basic Info defaults from the UI form).
// Throwaway drradar-test.com account; publishable key only; RLS applies.
// Usage: node scripts/debug-profile-save-repro.mjs
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
if (!url || !key) { console.error('FATAL: missing env'); process.exit(1); }
const supabase = createClient(url, key);
const errOf = (e) => (e ? { code: e.code ?? null, status: e.status ?? null, message: e.message, details: e.details ?? null, hint: e.hint ?? null } : null);

const stamp = Date.now().toString(36);
const email = `buffy.save.${stamp}@drradar-test.com`;
const pw = 'Buffy-Save-2026!x';

console.log('[1] signUp:', email);
const { data, error } = await supabase.auth.signUp({ email, password: pw });
if (error || !data.session) {
  console.error('[1] FAILED', JSON.stringify(errOf(error)), '| session:', Boolean(data?.session));
  process.exit(2);
}
console.log('[1] signed up:', data.user.id);

console.log('[2] users upsert (provisionAccount step 1)…');
{
  const { error } = await supabase.from('users').upsert({
    id: data.user.id,
    email: data.user.email,
    role: 'patient',
    first_name: 'Buffy',
    last_name: 'Save',
    display_name: 'Buffy Save',
    password_hash: 'supabase-auth-managed',
    avatar_url: null,
    onboarding_completed: true,
    profile_completed: true,
  }, { onConflict: 'id' });
  console.log('[2] users upsert:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK');
  if (error) process.exit(3);
}

console.log('[3] rpc ensure_patient_profile…');
const { data: patientId, error: rpcError } = await supabase.rpc('ensure_patient_profile');
console.log('[3] rpc:', error ? `FAILED ${JSON.stringify(errOf(rpcError))}` : `OK patientId=${patientId}`);
if (rpcError) process.exit(4);

console.log('[4] patients upsert (provisionAccount step 2, onboarding defaults)…');
{
  const profileRow = {
    user_id: data.user.id,
    dob: '1990-05-12',
    gender: 'Prefer not to say',
    country: 'United States',
    language: 'English (US)',
  };
  const { error } = await supabase.from('patients').upsert(profileRow, { onConflict: 'user_id' });
  console.log('[4] patients upsert:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK');
  if (error) process.exit(5);
}

console.log('[5] health_profiles upsert (HealthAssessmentScreen path)…');
{
  const { error } = await supabase.from('health_profiles').upsert({
    patient_id: patientId,
    primary_goal: null,
    goal_description: null,
    symptoms: {},
    conditions: {},
    medications: {},
    allergies: {},
    procedures: {},
    family_history: {},
    lifestyle: {},
    previous_tests: {},
    completion_percentage: 10,
    last_updated: new Date().toISOString(),
  }, { onConflict: 'patient_id' });
  console.log('[5] health_profiles upsert:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK');
  if (error) process.exit(6);
}

console.log('[done] ALL SAVES OK — test rows left in place:', data.user.id);
process.exit(0);
