import { UserRole } from '../types';

export interface AssistantAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  status: 'uploading' | 'analyzing' | 'attached' | 'error';
  url?: string;
  previewUrl?: string;
}

export interface AssistantStructuredContent {
  whatItMeans?: string;
  whyItMatters?: string;
  whatDrRadarFound?: string;
  whatToDiscussWithDoctor?: string[];
  clinicalSummary?: string;
  technicalDetails?: string;
  isUrgent?: boolean;
  emergencyNotice?: string;
}

export interface AssistantContext {
  type: 'ecg' | 'imaging' | 'chronic' | 'cancer' | 'liver' | 'patient' | 'general';
  title: string;
  subtitle?: string;
  sampleId?: string;
  recordId?: string;
  patientId?: string;
  patientName?: string;
  prediction?: string;
  confidence?: string | number;
  heartRate?: number;
  aamiClass?: 'N' | 'S' | 'V' | 'F' | 'Q' | string;
  intervals?: {
    prMs?: number;
    qrsMs?: number;
    qtMs?: number;
  };
  metrics?: Record<string, string | number>;
  clinicalNotes?: string;
  findings?: string;
  source?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  structured?: AssistantStructuredContent;
  contextAttached?: AssistantContext;
  attachments?: AssistantAttachment[];
  isError?: boolean;
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  role: UserRole;
  context?: AssistantContext;
  messages: AssistantMessage[];
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';
