import { useEffect, useRef, useState } from "react";

type InternalSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

export type SpeechRecognitionStatus = "idle" | "unsupported" | "ready" | "listening" | "error";

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {},
) => {
  const { onResult, onError } = options;
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const recognitionRef = useRef<InternalSpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionImpl =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) {
      setStatus("unsupported");
      return;
    }

    const recognition: InternalSpeechRecognition = new SpeechRecognitionImpl();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
    };

    recognition.onerror = (event: { error: string }) => {
      setStatus("error");
      if (onError) onError(event.error || "Erro no reconhecimento de voz.");
    };

    recognition.onend = () => {
      if (status === "listening") {
        setStatus("ready");
      }
    };

    recognition.onresult = (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
      const transcript = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (transcript && onResult) {
        onResult(transcript);
      }
    };

    recognitionRef.current = recognition;
    setStatus("ready");

    return () => {
      recognition.onstart = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // Ignora erro de start duplo
    }
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  };

  return {
    status,
    start,
    stop,
    isSupported: status !== "unsupported",
    isListening: status === "listening",
  };
};
