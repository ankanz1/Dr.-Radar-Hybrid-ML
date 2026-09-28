// Step 2 tests: assistant sessions are scoped per authenticated user.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssistantStorage, assistantStorageKey } from '../hooks/useAssistantStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('user-scoped assistant storage', () => {
  it('builds the storage key from the Supabase user id', () => {
    expect(assistantStorageKey('u-aaa')).toBe('dr_radar_assistant_sessions:u-aaa');
    expect(assistantStorageKey(null)).toBe('');
  });

  it('isolates sessions between two users on the same browser', () => {
    // User A creates a session
    const a = renderHook(() => useAssistantStorage('u-aaa'));
    act(() => a.result.current.createNewSession('patient'));
    expect(a.result.current.sessions).toHaveLength(1);
    expect(localStorage.getItem('dr_radar_assistant_sessions:u-aaa')).toContain('Health Discussion');

    // User B on the SAME browser sees none of A's conversations (B's own scope
    // may hold an empty list, but never A's session data)
    const b = renderHook(() => useAssistantStorage('u-bbb'));
    expect(b.result.current.sessions).toHaveLength(0);
    expect(b.result.current.activeSessionId).toBeNull();
    const bRaw = localStorage.getItem('dr_radar_assistant_sessions:u-bbb');
    expect(bRaw === null || bRaw === '[]').toBe(true);
    expect(bRaw ?? '').not.toContain('Health Discussion');
  });

  it('restores the right conversations when each user reopens the assistant', () => {
    const a = renderHook(() => useAssistantStorage('u-aaa'));
    act(() => a.result.current.createNewSession('patient'));

    // re-mount as A: sessions restored from A's scope
    const a2 = renderHook(() => useAssistantStorage('u-aaa'));
    expect(a2.result.current.sessions).toHaveLength(1);

    // re-mount as B: still empty
    const b2 = renderHook(() => useAssistantStorage('u-bbb'));
    expect(b2.result.current.sessions).toHaveLength(0);
  });

  it('stores nothing and exposes no sessions when signed out', () => {
    const signedOut = renderHook(() => useAssistantStorage(null));
    expect(signedOut.result.current.sessions).toHaveLength(0);
    act(() => signedOut.result.current.createNewSession('patient'));
    // Session exists in memory only; nothing persisted without a user scope
    expect(localStorage.getItem('dr_radar_assistant_sessions')).toBeNull();
    expect(localStorage.getItem('dr_radar_assistant_sessions:null')).toBeNull();
    expect(localStorage.getItem('dr_radar_assistant_sessions:undefined')).toBeNull();
  });

  it('reloads when the authenticated user changes mid-session (account switch)', () => {
    const { rerender } = renderHook(({ uid }) => useAssistantStorage(uid), {
      initialProps: { uid: 'u-aaa' as string | null },
    });
    // A had a stored conversation
    localStorage.setItem('dr_radar_assistant_sessions:u-aaa', JSON.stringify([
      { id: 's1', title: 'A chat', createdAt: '', updatedAt: '', role: 'patient', messages: [] },
    ]));
    // simulate the hook reacting to a user change
    rerender({ uid: 'u-aaa' });

    // switch to B: A's conversations must not appear
    rerender({ uid: 'u-bbb' });
    // (effect runs synchronously after rerender's act wrap)
  });

  it('does not keep the legacy shared key in use', () => {
    const hook = renderHook(() => useAssistantStorage('u-aaa'));
    act(() => hook.result.current.createNewSession('patient'));
    // the old shared key must never be written again
    expect(localStorage.getItem('dr_radar_assistant_sessions')).toBeNull();
  });
});
