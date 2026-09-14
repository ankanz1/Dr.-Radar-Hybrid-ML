import React, { useState, useRef, useEffect } from 'react';
import { UserRole, UserAccountState } from '../../types';
import {
  AssistantMessage,
  AssistantContext,
  AssistantAttachment,
} from '../../types/assistant';
import { useAssistantStorage } from '../../hooks/useAssistantStorage';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { askAssistantChat } from '../../services/clinicalAssistantEngine';
import { AssistantContextDrawer } from './AssistantContextDrawer';
import { AssistantPrivacyModal } from './AssistantPrivacyModal';
import { AboutDrRadarAIModal } from './AboutDrRadarAIModal';
import { ASSETS } from '../../data/mockData';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { HealthContextSummary } from '../../types/healthInfo';

interface AskDrRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  initialContext?: AssistantContext | null;
  onNavigateToTab?: (tab: any) => void;
  user?: UserAccountState;
  healthSummary?: HealthContextSummary;
}

export const AskDrRadarModal: React.FC<AskDrRadarModalProps> = ({
  isOpen,
  onClose,
  userRole,
  initialContext,
  onNavigateToTab,
  user,
  healthSummary,
}) => {
  const {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createNewSession,
    addMessage,
    deleteSession,
    renameSession,
    clearAllSessions,
  } = useAssistantStorage(userRole);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [showRightDrawer, setShowRightDrawer] = useState<boolean>(true);
  const [showHistoryMobile, setShowHistoryMobile] = useState<boolean>(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or attach context when opened
  useEffect(() => {
    if (isOpen) {
      if (sessions.length === 0) {
        createNewSession(userRole, initialContext || undefined);
      } else if (initialContext && activeSession?.context?.sampleId !== initialContext.sampleId) {
        // If a specific context is passed (e.g. from an ECG beat), open/create a focused session
        createNewSession(userRole, initialContext);
      }
    }
  }, [isOpen, initialContext, userRole]);

  // Voice recognition integration
  const handleVoiceTranscript = (text: string) => {
    setInputMessage((prev) => (prev ? `${prev} ${text}` : text));
  };

  const {
    state: voiceState,
    transcript: liveTranscript,
    isSupported: isVoiceSupported,
    errorMessage: voiceError,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechRecognition(handleVoiceTranscript);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading, voiceState]);

  if (!isOpen) return null;

  // Active conversation context
  const currentContext: AssistantContext | null =
    activeSession?.context || initialContext || null;

  // Suggested questions based on context and role
  const getSuggestedQuestions = (): string[] => {
    if (currentContext?.type === 'ecg') {
      return [
        'Why did I get this result?',
        'Explain the ECG waveform',
        'What does the confidence score mean?',
        'What does V (ventricular ectopic) mean?',
        'What should I ask my doctor?',
        'Compare with my previous results',
      ];
    }

    if (userRole === 'doctor') {
      return [
        'Summarize this patient’s telemetry history',
        'Explain the 10-qubit VQC confidence',
        'Identify arrhythmia trends across records',
        'Draft clinical sign-off documentation',
        'Check differential diagnosis considerations',
      ];
    }

    if (userRole === 'researcher') {
      return [
        'Explain why the model uses a bottleneck',
        'How does the 10-qubit VQC ansatz work?',
        'Compare quantum vs classical ablation metrics',
        'Explain angle encoding of the 187-D ECG vector',
      ];
    }

    // Default general patient questions
    return [
      'Explain my latest Dr. Radar result',
      'Ask about my ECG heart rhythm',
      'Explain a medical term',
      'Understand my test report',
      'Prepare questions for my doctor',
      'Can you explain heart rate variability?',
    ];
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    if (!activeSessionId) {
      const newSession = createNewSession(userRole, currentContext || undefined);
      sendMessageToSession(newSession.id, query);
    } else {
      sendMessageToSession(activeSessionId, query);
    }
  };

  const sendMessageToSession = async (sessionId: string, query: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: timeStr,
      contextAttached: currentContext || undefined,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    addMessage(sessionId, userMessage);
    setInputMessage('');
    setAttachments([]);
    clearTranscript();
    setIsLoading(true);

    try {
      const currentHistory = activeSession?.messages || [];
      const response = await askAssistantChat({
        message: query,
        role: userRole,
        context: currentContext || undefined,
        history: currentHistory,
      });

      const assistantMessage: AssistantMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        structured: response.structured,
        contextAttached: currentContext || undefined,
      };

      addMessage(sessionId, assistantMessage);
    } catch (err: any) {
      const errorMessage: AssistantMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'I apologize, but I encountered a temporary processing issue. Please feel free to retry your question, or consult your healthcare provider.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      addMessage(sessionId, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Attachment upload simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AssistantAttachment[] = Array.from(files).map((f: File) => ({
      id: `att-${Date.now()}-${Math.random()}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      type: f.type || 'document',
      status: 'attached',
    }));

    setAttachments((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Text to speech playback
  const handleSpeak = (messageId: string, text: string) => {
    if ('speechSynthesis' in window) {
      if (speakingMessageId === messageId) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
        return;
      }

      window.speechSynthesis.cancel();
      // Clean markdown tags for natural speech
      const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/#/g, '')
        .replace(/•/g, '')
        .replace(/\n+/g, ' ');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);

      setSpeakingMessageId(messageId);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Copy text to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <div
      id="ask-dr-radar-modal"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-0 md:p-4 lg:p-6 animate-in fade-in"
    >
      <div
        id="ask-dr-radar-container"
        className="bg-white w-full h-full md:h-[92vh] md:max-w-6xl rounded-none md:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden"
      >
        {/* TOP HEADER */}
        <header className="px-4 py-3 bg-[#f8fbfe] border-b border-slate-200/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* Back / Mobile Menu Toggle */}
            <button
              onClick={onClose}
              id="assistant-close-btn"
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 hover:text-[#bc000a] hover:bg-red-50 transition-colors cursor-pointer"
              title="Close Assistant"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>

            {/* Brand Title */}
            <div className="flex items-center gap-2.5">
              <img src={ASSETS.logo} alt="Dr. Radar" className="w-7 h-7 object-contain drop-shadow-xs" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-[#101c28] tracking-tight">
                    ASK DR. RADAR
                  </h2>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#ffe8e8] text-[#bc000a] font-bold border border-[#bc000a]/20">
                    AI Healthcare Assistant
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 hidden sm:block">
                  Hybrid Quantum–Classical Healthcare Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Center Context Pill if active */}
          {currentContext && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-2xs text-[11px] font-mono text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-[#bc000a]">{currentContext.type.toUpperCase()}:</span>
              <span>{currentContext.title}</span>
              {currentContext.confidence && (
                <span className="text-slate-400">({currentContext.confidence})</span>
              )}
            </div>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile History Toggle */}
            <button
              onClick={() => setShowHistoryMobile(!showHistoryMobile)}
              className="md:hidden px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>Chats</span>
            </button>

            {/* Privacy & Research Consent Button */}
            <button
              onClick={() => setIsPrivacyOpen(true)}
              id="assistant-privacy-btn"
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-600 hover:text-blue-700 hover:border-blue-300 transition-colors cursor-pointer"
              title="Privacy & Consent Controls"
            >
              <span className="material-symbols-outlined text-[18px]">shield</span>
            </button>

            {/* Desktop Context Drawer Toggle */}
            <button
              onClick={() => setShowRightDrawer(!showRightDrawer)}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#bc000a] text-xs font-semibold transition-colors cursor-pointer"
              title="Toggle Context Inspector"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showRightDrawer ? 'right_panel_close' : 'right_panel_open'}
              </span>
              <span>Context</span>
            </button>
          </div>
        </header>

        {/* WORKSPACE: LEFT CHAT LIST + CENTER CONVERSATION + RIGHT CONTEXT */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* 1. LEFT PANEL: CONVERSATION HISTORY (Desktop Sidebar or Mobile Overlay) */}
          <aside
            className={`${
              showHistoryMobile ? 'flex' : 'hidden'
            } md:flex flex-col w-full md:w-64 lg:w-72 bg-[#f8fbfe] border-r border-slate-200/90 shrink-0 absolute md:static inset-0 z-30`}
          >
            <div className="p-3 border-b border-slate-200/80 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  createNewSession(userRole, currentContext || undefined);
                  setShowHistoryMobile(false);
                }}
                id="assistant-new-chat-btn"
                className="w-full py-2 px-3 bg-[#bc000a] hover:bg-[#a10008] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>New Conversation</span>
              </button>
              {showHistoryMobile && (
                <button
                  onClick={() => setShowHistoryMobile(false)}
                  className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
              <div className="px-2 py-1 flex items-center justify-between text-[10.5px] font-mono uppercase font-bold text-slate-400">
                <span>Recent Conversations</span>
                <span>{sessions.length}</span>
              </div>

              {sessions.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  <p>No previous conversations.</p>
                  <p className="text-[11px] mt-1">Start a new query above.</p>
                </div>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isEditing = editingSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        setActiveSessionId(session.id);
                        setShowHistoryMobile(false);
                      }}
                      className={`group p-2.5 rounded-2xl border transition-all cursor-pointer relative ${
                        isActive
                          ? 'bg-white border-[#bc000a]/50 shadow-2xs text-[#101c28]'
                          : 'bg-transparent border-transparent hover:bg-slate-200/50 text-slate-600'
                      }`}
                    >
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                renameSession(session.id, editingTitle);
                                setEditingSessionId(null);
                              }
                            }}
                            className="w-full text-xs font-bold border rounded px-1.5 py-0.5 bg-white"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              renameSession(session.id, editingTitle);
                              setEditingSessionId(null);
                            }}
                            className="text-emerald-600"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="truncate flex-1">
                            <span className="font-bold block truncate text-xs text-[#101c28]">
                              {session.title}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>{session.updatedAt}</span>
                              {session.context && (
                                <span className="text-[#bc000a] font-bold">
                                  • {session.context.type.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action icons on hover */}
                          <div
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setEditingSessionId(session.id);
                                setEditingTitle(session.title);
                              }}
                              className="p-1 hover:text-slate-900 text-slate-400 rounded"
                              title="Rename"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                            <button
                              onClick={() => deleteSession(session.id)}
                              className="p-1 hover:text-red-600 text-slate-400 rounded"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom history actions */}
            {sessions.length > 0 && (
              <div className="p-3 border-t border-slate-200/80 bg-white/70">
                <button
                  onClick={() => {
                    if (confirm('Clear all conversation history?')) {
                      clearAllSessions();
                    }
                  }}
                  className="w-full text-center text-[11px] text-slate-500 hover:text-red-600 flex items-center justify-center gap-1 cursor-pointer font-medium"
                >
                  <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                  Clear All History
                </button>
              </div>
            )}
          </aside>

          {/* 2. CENTER PANEL: MESSAGES THREAD & INPUT */}
          <section className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
            {/* Messages Thread */}
            <div
              id="assistant-messages-scroll"
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5"
            >
              {/* Health Context Banner (Section 11) */}
              {userRole === 'patient' && healthSummary && (
                <div className="bg-[#f8fbfe] border border-slate-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#ffe8e8] text-[#bc000a] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">vital_signs</span>
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#101c28]">Using your health context:</span>
                        <span className="text-slate-700 font-semibold">{healthSummary.patientName}</span>
                        <span className="text-slate-400">• Age {healthSummary.age}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] truncate mt-0.5">
                        {healthSummary.hasHypertension ? 'Hypertension (Managed) • ' : ''}
                        {healthSummary.topMedications?.length ? `Meds: ${healthSummary.topMedications.join(', ')} • ` : ''}
                        {healthSummary.recordCount} records on file
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab?.('health-info');
                    }}
                    className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#bc000a] text-xs font-semibold text-[#bc000a] flex items-center gap-1 shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Update context</span>
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </button>
                </div>
              )}

              {activeSession?.messages.map((message) => {
                const isUser = message.sender === 'user';

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    {/* Speaker Header */}
                    <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400 font-mono">
                      {isUser ? (
                        <>
                          <span>{message.timestamp}</span>
                          <span className="font-bold text-slate-700">You</span>
                          {user && <ProfileAvatar user={user} size="xs" />}
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-full bg-[#bc000a] text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                            R
                          </div>
                          <span className="font-bold text-[#101c28]">Dr. Radar AI</span>
                          <span>{message.timestamp}</span>
                        </>
                      )}
                    </div>

                    {/* Speech Bubble */}
                    <div
                      className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-sm leading-relaxed transition-all shadow-2xs ${
                        isUser
                          ? 'bg-[#101c28] text-white rounded-tr-none'
                          : message.isError
                          ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-none'
                          : 'bg-[#f8fbfe] border border-slate-200/90 text-slate-800 rounded-tl-none matte-3d-card'
                      }`}
                    >
                      {/* Attached Context Header if user attached */}
                      {message.contextAttached && isUser && (
                        <div className="mb-2 pb-2 border-b border-white/20 text-xs text-sky-200 flex items-center gap-1.5 font-mono">
                          <span className="material-symbols-outlined text-[14px]">attachment</span>
                          <span>Context: {message.contextAttached.title}</span>
                          {message.contextAttached.prediction && (
                            <span>• {message.contextAttached.prediction}</span>
                          )}
                        </div>
                      )}

                      {/* Attached Files Badge if any */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2.5 flex flex-wrap gap-1.5">
                          {message.attachments.map((att) => (
                            <span
                              key={att.id}
                              className="px-2 py-1 rounded-lg bg-white/20 text-white text-xs flex items-center gap-1 font-mono"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                description
                              </span>
                              <span>{att.name}</span>
                              <span className="text-white/60 text-[10px]">({att.size})</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Emergency Callout Card if urgent */}
                      {message.structured?.isUrgent && (
                        <div className="mb-3 p-3.5 rounded-xl bg-red-100 border-2 border-red-500 text-red-950 font-medium space-y-2">
                          <div className="flex items-center gap-2 font-bold text-red-900">
                            <span className="material-symbols-outlined text-[20px] text-red-600">
                              warning
                            </span>
                            <span>URGENT MEDICAL NOTICE</span>
                          </div>
                          <p className="text-xs leading-relaxed">
                            {message.structured.emergencyNotice}
                          </p>
                          <div className="pt-1 flex items-center gap-2">
                            <span className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold">
                              Call Emergency Services (911)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Main Message Text (with simple markdown formatting) */}
                      <div className="space-y-2.5 text-xs sm:text-sm whitespace-pre-wrap">
                        {message.text.split('\n\n').map((para, pIdx) => {
                          // Format bold headers
                          if (
                            para.startsWith('**WHAT IT MEANS**') ||
                            para.startsWith('**WHY IT MATTERS**') ||
                            para.startsWith('**WHAT DR. RADAR FOUND**') ||
                            para.startsWith('**WHAT YOU CAN DISCUSS WITH YOUR DOCTOR**')
                          ) {
                            const [heading, ...rest] = para.split('\n');
                            const cleanHeading = heading.replace(/\*\*/g, '');
                            return (
                              <div
                                key={pIdx}
                                className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1 my-2"
                              >
                                <span className="font-mono text-[10.5px] uppercase font-bold text-[#bc000a] block">
                                  {cleanHeading}
                                </span>
                                <div className="text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                                  {rest.join('\n')}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <p key={pIdx} className="leading-relaxed">
                              {para}
                            </p>
                          );
                        })}
                      </div>

                      {/* Structured checklist items if available */}
                      {message.structured?.whatToDiscussWithDoctor &&
                        message.structured.whatToDiscussWithDoctor.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                            <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-1.5">
                              Suggested Discussion Points For Your Next Appointment:
                            </span>
                            <ul className="space-y-1 text-xs text-slate-700">
                              {message.structured.whatToDiscussWithDoctor.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="material-symbols-outlined text-[15px] text-[#bc000a] shrink-0 mt-0.5">
                                    check_box
                                  </span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {/* Message bottom actions (Copy & Audio Speech) */}
                      {!isUser && (
                        <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="text-[10px] font-mono">
                            AI healthcare decision support
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSpeak(message.id, message.text)}
                              className={`p-1 rounded hover:bg-slate-200/70 transition-colors flex items-center gap-1 ${
                                speakingMessageId === message.id ? 'text-[#bc000a] font-bold' : ''
                              }`}
                              title={speakingMessageId === message.id ? 'Stop audio' : 'Listen'}
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {speakingMessageId === message.id ? 'volume_off' : 'volume_up'}
                              </span>
                            </button>
                            <button
                              onClick={() => handleCopy(message.id, message.text)}
                              className="p-1 rounded hover:bg-slate-200/70 transition-colors flex items-center gap-1"
                              title="Copy response"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {copiedMessageId === message.id ? 'done' : 'content_copy'}
                              </span>
                              {copiedMessageId === message.id && (
                                <span className="text-[10px] text-emerald-600 font-bold">
                                  Copied
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-[#bc000a] text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-1">
                    R
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-none bg-[#f8fbfe] border border-slate-200/90 text-slate-600 flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-[18px] text-[#bc000a] animate-spin">
                      progress_activity
                    </span>
                    <span>Analyzing Dr. Radar telemetry and clinical standards...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* SUGGESTED QUESTIONS CHIPS */}
            <div className="px-4 py-2 bg-white/95 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 shrink-0 mr-1">
                Suggested:
              </span>
              {getSuggestedQuestions().map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-[#ffe8e8] hover:text-[#bc000a] text-slate-700 text-xs font-medium border border-slate-200/80 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* ATTACHMENT PREVIEW CHIP (if files are chosen) */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200/70 flex flex-wrap gap-2 shrink-0">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-300 text-xs flex items-center gap-2 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px] text-blue-600">
                      description
                    </span>
                    <span className="font-medium text-slate-800">{att.name}</span>
                    <span className="text-slate-400 font-mono text-[10px]">({att.size})</span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* LIVE VOICE RECORDING STATUS BANNER */}
            {voiceState === 'listening' && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between text-xs text-red-900 animate-pulse shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                  <span className="font-bold">Listening... Speak your health question.</span>
                  {liveTranscript && (
                    <span className="italic text-slate-600 truncate max-w-sm">
                      "{liveTranscript}"
                    </span>
                  )}
                </div>
                <button
                  onClick={stopListening}
                  className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Done Speaking
                </button>
              </div>
            )}

            {voiceError && (
              <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
                <span>{voiceError}</span>
                <button
                  onClick={clearTranscript}
                  className="text-amber-900 font-bold hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* INPUT AREA */}
            <div className="p-3 sm:p-4 bg-[#f8fbfe] border-t border-slate-200/90 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                {/* File Attachment Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept=".csv,.dat,.txt,.pdf,.png,.jpg,.jpeg"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-[#bc000a] hover:border-red-200 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0"
                  title="Attach ECG, scan or lab document"
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </button>

                {/* Text Input Box */}
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    currentContext
                      ? `Ask about ${currentContext.title}...`
                      : 'Ask Dr. Radar a question about your results or health...'
                  }
                  className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#bc000a] focus:ring-2 focus:ring-[#bc000a]/10 shadow-2xs"
                />

                {/* Voice Input Microphone Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (voiceState === 'listening') {
                      stopListening();
                    } else {
                      startListening();
                    }
                  }}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0 ${
                    voiceState === 'listening'
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-[#bc000a] hover:border-red-200'
                  }`}
                  title={
                    isVoiceSupported
                      ? voiceState === 'listening'
                        ? 'Stop listening'
                        : 'Speak with voice'
                      : 'Voice input not supported in this browser'
                  }
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {voiceState === 'listening' ? 'mic' : 'mic_none'}
                  </span>
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="w-10 h-10 rounded-2xl bg-[#bc000a] hover:bg-[#a10008] text-white flex items-center justify-center shadow-2xs transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                  title="Send message"
                >
                  <span className="material-symbols-outlined text-[19px]">send</span>
                </button>
              </form>

              {/* Safety Sub-Disclaimer */}
              <p className="text-[10px] text-center text-slate-400 mt-2">
                Dr. Radar AI is an AI healthcare assistant, not a doctor. Verify clinical results with your healthcare provider.
              </p>
            </div>
          </section>

          {/* 3. RIGHT PANEL: COLLAPSIBLE CONTEXT DRAWER (Desktop) */}
          {showRightDrawer && (
            <aside className="hidden lg:block w-72 xl:w-80 h-full shrink-0">
              <AssistantContextDrawer
                context={currentContext}
                onClearContext={() => {
                  // Detach context
                  if (activeSession) {
                    activeSession.context = undefined;
                  }
                }}
              />
            </aside>
          )}
        </div>
      </div>

      {/* Auxiliary Modals */}
      <AssistantPrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
        onClearHistory={clearAllSessions}
      />

      <AboutDrRadarAIModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};
