// Tests for server/auth.ts — run with: node --test server/auth.test.mjs
// Verifies Bearer extraction, token verification against a mocked Supabase
// endpoint, and role resolution from the caller's own users row.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://stub.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'anon-key';

const { extractBearerToken, verifySupabaseToken } = await import('./auth.ts');

const VALID_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.sig';

test('extractBearerToken accepts a well-formed Bearer JWT', () => {
  assert.equal(extractBearerToken(`Bearer ${VALID_JWT}`), VALID_JWT);
});

test('extractBearerToken rejects missing header, wrong scheme, malformed JWT', () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken(''), null);
  assert.equal(extractBearerToken('Basic abc.def.ghi'), null);
  assert.equal(extractBearerToken('Bearer'), null);
  assert.equal(extractBearerToken('Bearer not-a-jwt'), null);
  assert.equal(extractBearerToken('Bearer a.b'), null); // only two segments
  assert.equal(extractBearerToken('Bearer   '), null);
});

test('verifySupabaseToken rejects when Supabase says 401', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  try {
    const result = await verifySupabaseToken(VALID_JWT);
    assert.equal(result.status, 'rejected');
  } finally {
    globalThis.fetch = original;
  }
});

test('verifySupabaseToken rejects network failure', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('ECONNREFUSED');
  };
  try {
    const result = await verifySupabaseToken(VALID_JWT);
    assert.equal(result.status, 'rejected');
  } finally {
    globalThis.fetch = original;
  }
});

test('verifySupabaseToken resolves role from the caller own users row', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return {
        ok: true,
        json: async () => ({ id: '11111111-1111-4111-8111-111111111111', email: 'doc@test.local' }),
      };
    }
    if (u.includes('/rest/v1/users')) {
      assert.ok(u.includes('id=eq.11111111-1111-4111-8111-111111111111'), 'must query the verified user id only');
      return { ok: true, json: async () => [{ role: 'doctor' }] };
    }
    throw new Error('unexpected url ' + u);
  };
  try {
    const result = await verifySupabaseToken(VALID_JWT);
    assert.equal(result.status, 'ok');
    assert.equal(result.user.id, '11111111-1111-4111-8111-111111111111');
    assert.equal(result.user.role, 'doctor');
    assert.equal(result.user.roleSource, 'database');
  } finally {
    globalThis.fetch = original;
  }
});

test('verifySupabaseToken falls back to token metadata then unknown', async () => {
  const original = globalThis.fetch;
  // No users row -> metadata fallback
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return { ok: true, json: async () => ({ id: '22222222-2222-4222-8222-222222222222', user_metadata: { role: 'patient' } }) };
    }
    return { ok: true, json: async () => [] };
  };
  try {
    const r1 = await verifySupabaseToken(VALID_JWT);
    assert.equal(r1.user.role, 'patient');
    assert.equal(r1.user.roleSource, 'token-metadata');

    // Neither -> unknown (never a default 'patient')
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: '33333333-3333-4333-8333-333333333333' }) };
      return { ok: true, json: async () => [] };
    };
    const r2 = await verifySupabaseToken(VALID_JWT);
    assert.equal(r2.user.role, null);
    assert.equal(r2.user.roleSource, 'unknown');
  } finally {
    globalThis.fetch = original;
  }
});
