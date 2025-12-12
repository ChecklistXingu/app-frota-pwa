import { useState, useCallback, useRef } from "react";

// Tipos para a Web Speech API
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onspeechend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}

/**
 * Hook para reconhecimento de voz usando Web Speech API
 */
// Tempo máximo de escuta em milissegundos (10 segundos)
const MAX_LISTEN_TIME = 10000;

export const useVoiceInput = (): UseVoiceInputReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verifica se o navegador suporta
  const isSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Limpa o timeout
  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Seu navegador não suporta reconhecimento de voz");
      return;
    }

    setError(null);
    setTranscript("");
    clearTimeoutRef();

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    recognition.lang = "pt-BR";
    recognition.continuous = true; // Mantém aberto até parar manualmente
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Pega o último resultado
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const result = lastResult[0].transcript;
        console.log("[Voice] Reconhecido:", result);
        setTranscript(result);
        
        // Para o reconhecimento após receber resultado final
        clearTimeoutRef();
        recognition.stop();
        setIsListening(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[Voice] Erro:", event.error);
      clearTimeoutRef();
      
      switch (event.error) {
        case "no-speech":
          setError("Nenhuma fala detectada. Tente novamente.");
          break;
        case "audio-capture":
          setError("Microfone não encontrado.");
          break;
        case "not-allowed":
          setError("Permissão de microfone negada.");
          break;
        case "aborted":
          // Ignorar - foi cancelado pelo usuário ou timeout
          break;
        default:
          setError("Erro no reconhecimento de voz.");
      }
      
      setIsListening(false);
    };

    recognition.onend = () => {
      clearTimeoutRef();
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);

    // Timeout de 10 segundos
    timeoutRef.current = setTimeout(() => {
      console.log("[Voice] Timeout - 10 segundos");
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setError("Tempo esgotado. Toque para falar novamente.");
    }, MAX_LISTEN_TIME);

  }, [isSupported, clearTimeoutRef]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
  };
};
