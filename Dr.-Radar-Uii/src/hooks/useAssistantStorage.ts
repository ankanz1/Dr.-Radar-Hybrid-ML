import { useState, useEffect, useCallback } from 'react';
import { ConversationSession, AssistantMessage, AssistantContext } from '../types/assistant';
import { UserRole } from '../types';

/**
 * Assistant conversation storage — scoped per authenticated Supabase user.
 *
 * Step 2 fix: the key is `dr_radar_assistant_sessions:<supabase-user-id>`, so
 * two accounts on the same browser never see each other's conversations.
 * Access tokens are NEVER stored here (or anywhere client-persistent); the
 * token lives only in the in-memory Supabase session. When no user id is
 * provided (signed out), the hook exposes no sessions and cannot persist.
 */

const STORAGE_KEY_PREFIX = 'dr_radar_assistant_sessions';

export function assistantStorageKey(userId: string | null | undefined): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : '';
}

export function useAssistantStorage(userId: string | null | undefined, defaultRole: UserRole = 'patient') {
  const storageKey = assistantStorageKey(userId);

  const [sessions, setSessions] = useState<ConversationSession[]>(() => {
    if (!storageKey) return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load assistant sessions:', e);
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return sessions.length > 0 ? sessions[0].id : null;
  });

  // Reload when the authenticated user changes (account switch on one browser)
  useEffect(() => {
    if (!storageKey) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      setSessions(saved ? JSON.parse(saved) : []);
    } catch (e) {
      console.error('Failed to load assistant sessions:', e);
      setSessions([]);
    }
    setActiveSessionId(null);
  }, [storageKey]);

  // Sync to local storage whenever sessions change (never without a user scope)
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save assistant sessions to localStorage:', e);
    }
  }, [sessions, storageKey]);

  // Create a new session
  const createNewSession = useCallback(
    (role: UserRole = defaultRole, context?: AssistantContext): ConversationSession => {
      const id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });

      let title = 'Health Discussion';
      if (context) {
        if (context.type === 'ecg') {
          title = `ECG Analysis (${context.sampleId || context.prediction || 'Lead II'})`;
        } else if (context.type === 'imaging') {
          title = `${context.title || 'Imaging Scan Review'}`;
        } else if (context.patientName) {
          title = `${context.patientName} - Clinical Review`;
        } else if (context.title) {
          title = context.title;
        }
      }

      // Initial welcome message (no hardcoded identities)
      const welcomeText =
        role === 'doctor'
          ? `Welcome to **Ask Dr. Radar** clinical decision support.\n\nI can help summarize patient telemetry, correlate 5-class AAMI predictions with baseline records, and draft clinical review documentation. ${
              context ? `\n\n*Active Context:* **${context.title}** (${context.prediction || 'Telemetry'})` : ''
            }`
          : role === 'researcher'
          ? `Welcome to **Ask Dr. Radar** researcher intelligence.\n\nI can explain the hybrid quantum-classical pipeline, information bottleneck layer, 10-qubit VQC ansatz, and ablation benchmarks.`
          : `Hello! I'm **Dr. Radar AI**.\n\nI can help you understand your health measurements, explain medical terms, and review your Dr. Radar test results in simple, plain language.\n\n*Remember: I am an AI healthcare assistant and cannot diagnose or prescribe. Always consult your doctor for medical advice.*`;

      const initialMessage: AssistantMessage = {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: welcomeText,
        timestamp: timeStr,
        contextAttached: context,
      };

      const newSession: ConversationSession = {
        id,
        title,
        createdAt: `${dateStr}, ${timeStr}`,
        updatedAt: `${dateStr}, ${timeStr}`,
        role,
        context,
        messages: [initialMessage],
      };

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(id);
      return newSession;
    },
    [defaultRole]
  );

  // Add message to current active session
  const addMessage = useCallback((sessionId: string, message: AssistantMessage) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === sessionId) {
          const updatedMessages = [...session.messages, message];
          // Auto-generate title from first user query if still generic
          let newTitle = session.title;
          if (
            session.title === 'Health Discussion' &&
            message.sender === 'user' &&
            message.text.length > 3
          ) {
            newTitle =
              message.text.length > 28
                ? message.text.substring(0, 28) + '...'
                : message.text;
          }
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });

          return {
            ...session,
            title: newTitle,
            updatedAt: `${dateStr}, ${timeStr}`,
            messages: updatedMessages,
          };
        }
        return session;
      })
    );
  }, []);

  // Update session context (e.g. when user switches ECG or patient)
  const setSessionContext = useCallback((sessionId: string, context: AssistantContext) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === sessionId) {
          return {
            ...session,
            context,
          };
        }
        return session;
      })
    );
  }, []);

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      return filtered;
    });
    setActiveSessionId((current) => {
      if (current === sessionId) {
        return null;
      }
      return current;
    });
  }, []);

  // Rename a session
  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle.trim() } : s))
    );
  }, []);

  // Clear all sessions (only ever touches the CURRENT user's scope)
  const clearAllSessions = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createNewSession,
    addMessage,
    setSessionContext,
    deleteSession,
    renameSession,
    clearAllSessions,
  };
}
