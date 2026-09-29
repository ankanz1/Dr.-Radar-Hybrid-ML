// TEMPORARY DIAGNOSTIC — prove the exact 409 mechanism on public.users.
// Scenario: a public.users row already exists with the SAME EMAIL but a
// DIFFERENT id (legacy/foreign row). A new auth user with that email signs in;
// the login-time sync SELECT (by id) sees no row, the INSERT then violates
// users_email_key → PostgREST 409 on /rest/v1/users?on_conflict=id.
// Uses two throwaway auth users + test emails only (drradar-test.com).
// Usage: node scripts/debug-409-email-collision.mjs
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

// --- User A: owns the colliding email ---
const stamp = Date.now().toString(36);
const emailA = `buffy.owner.${stamp}@drradar-test.com`;
const emailB = `buffy.collide.${stamp}@drradar-test.com`;
const pw = 'Buffy-409-Proof-2026!x';

console.log('[A] signUp:', emailA);
const { data: a, error: aErr } = await supabase.auth.signUp({ email: emailA, password: pw });
if (aErr || !a.session) { console.error('[A] FAILED', JSON.stringify(errOf(aErr))); process.exit(2); }
const userA = a.user;
console.log('[A] id:', userA.id);

console.log('[A] provisioning users row (current login-time insert payload)…');
{
  const { error } = await supabase.from('users').upsert({
    id: userA.id, email: userA.email, role: 'patient',
    first_name: 'Buffy', last_name: 'Owner', display_name: 'Buffy Owner',
    password_hash: 'supabase-auth-managed', onboarding_completed: false, profile_completed: false,
  }, { onConflict: 'id' });
  console.log('[A] users upsert:', error ? `FAILED ${JSON.stringify(errOf(error))}` : 'OK');
}

// --- User B: same email as an EXISTING row? No — B gets its own email, but we
// simulate the legacy collision: sign up B normally, then DELETE B's users row
// is impossible without service role. Instead: create the collision by having
// B attempt an insert with A's email (exactly what a stale draft/legacy row
// scenario produces server-side). We emulate the CLIENT-SIDE condition:
// B's auth email differs from the email in the users INSERT payload. ---
await supabase.auth.signOut();
console.log('[B] signUp:', emailB);
const { data: b, error: bErr } = await supabase.auth.signUp({ email: emailB, password: pw });
if (bErr || !b.session) { console.error('[B] FAILED', JSON.stringify(errOf(bErr))); process.exit(3); }
const userB = b.user;
console.log('[B] id:', userB.id);

console.log('[B] sync SELECT (by id) →', JSON.stringify(
  await (await supabase.from('users').select('id, onboarding_completed').eq('id', userB.id).maybeSingle())
));

console.log('[B] THE COLLISION: login-time insert with email =', emailA, '(already owned by', userA.id, ')…');
{
  const { error } = await supabase.from('users').upsert({
    id: userB.id, email: emailA, role: 'patient',
    first_name: 'Buffy', last_name: 'Collide', display_name: 'Buffy Collide',
    password_hash: 'supabase-auth-managed', onboarding_completed: false, profile_completed: false,
  }, { onConflict: 'id' });
  if (error) console.error('[B] RESULT (expected 409):', JSON.stringify(errOf(error)));
  else console.log('[B] unexpectedly OK — no collision');
}

console.log('[done] A:', userA.id, 'B:', userB.id, '(test rows left in place for inspection)');
