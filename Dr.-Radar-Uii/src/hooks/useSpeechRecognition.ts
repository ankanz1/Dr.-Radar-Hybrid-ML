import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState } from '../types/assistant';

interface SpeechRecognitionHook {
  state: VoiceState;
  transcript: string;
  isSupported: boolean;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
}

export function useSpeechRecognition(onResultCallback?: (text: string) => void): SpeechRecognitionHook {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setState('listening');
          setErrorMessage(null);
        };

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const piece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += piece;
            } else {
              currentInterim += piece;
            }
          }

          const combined = finalTranscript || currentInterim;
          setTranscript(combined);
          if (finalTranscript && onResultCallback) {
            onResultCallback(finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setState('error');
          if (event.error === 'not-allowed') {
            setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
          } else if (event.error === 'no-speech') {
            setErrorMessage('No speech detected. Please speak clearly into your microphone.');
          } else {
            setErrorMessage(`Voice input error: ${event.error || 'Unable to recognize audio'}`);
          }
        };

        recognition.onend = () => {
          setState('idle');
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Failed to initialize SpeechRecognition:', err);
        setIsSupported(false);
      }
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [onResultCallback]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not supported in this browser environment.');
      return;
    }
    try {
      setTranscript('');
      setErrorMessage(null);
      recognitionRef.current.start();
    } catch (err: any) {
      console.warn('Recognition start failed:', err);
      // Sometimes start is called when already running
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current.start();
        }, 150);
      } catch {
        setErrorMessage('Unable to start microphone.');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setState('idle');
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setErrorMessage(null);
  }, []);

  return {
    state,
    transcript,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
    clearTranscript,
  };
}
