import { useEffect, useMemo, useRef, useState } from "react";

type RecorderStatus = "idle" | "recording" | "paused" | "finalized" | "unsupported" | "error";

type UseAudioRecorderResult = {
  status: RecorderStatus;
  error: string | null;
  durationSeconds: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  mimeType: string | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
};

const MIME_TYPE_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

const getSupportedMimeType = (): string | null => {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return null;
  }
  return MIME_TYPE_PREFERENCES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) || null;
};

export const useAudioRecorder = (): UseAudioRecorderResult => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const mimeType = useMemo(() => mimeTypeRef.current, [audioBlob, status]);

  const cleanupStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const revokeAudioUrl = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const resetRecording = () => {
    mediaRecorderRef.current?.stop();
    cleanupStream();
    chunksRef.current = [];
    startTimestampRef.current = null;
    accumulatedMsRef.current = 0;
    revokeAudioUrl();
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationSeconds(0);
    setError(null);
    setStatus("idle");
  };

  const handleUnsupported = () => {
    setStatus("unsupported");
    setError("Gravação de áudio não é suportada neste dispositivo/navegador.");
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      handleUnsupported();
      return;
    }

    if (status === "recording") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeTypeCandidate = getSupportedMimeType();
      mimeTypeRef.current = mimeTypeCandidate;

      const recorderOptions: MediaRecorderOptions = {};
      if (mimeTypeCandidate) {
        recorderOptions.mimeType = mimeTypeCandidate;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      revokeAudioUrl();
      setAudioBlob(null);
      setAudioUrl(null);
      setDurationSeconds(0);
      accumulatedMsRef.current = 0;
      startTimestampRef.current = Date.now();
      setError(null);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setStatus("recording");
      };

      recorder.onpause = () => {
        if (startTimestampRef.current) {
          accumulatedMsRef.current += Date.now() - startTimestampRef.current;
          startTimestampRef.current = null;
        }
        setStatus("paused");
      };

      recorder.onresume = () => {
        startTimestampRef.current = Date.now();
        setStatus("recording");
      };

      recorder.onerror = (ev) => {
        console.error("MediaRecorder error", ev);
        setError("Erro ao gravar áudio. Tente novamente.");
        setStatus("error");
      };

      recorder.onstop = () => {
        if (startTimestampRef.current) {
          accumulatedMsRef.current += Date.now() - startTimestampRef.current;
          startTimestampRef.current = null;
        }
        const totalMs = accumulatedMsRef.current;
        setDurationSeconds(Math.round(totalMs / 1000));
        accumulatedMsRef.current = 0;

        const type = mimeTypeRef.current || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        chunksRef.current = [];
        cleanupStream();
        setStatus("finalized");
      };

      recorder.start();
    } catch (err) {
      console.error("Erro ao iniciar gravação", err);
      setError("Não foi possível acessar o microfone.");
      setStatus("error");
      cleanupStream();
    }
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }
    recorder.pause();
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      return;
    }
    startTimestampRef.current = Date.now();
    recorder.resume();
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || (recorder.state !== "recording" && recorder.state !== "paused")) {
      return;
    }
    recorder.stop();
  };

  useEffect(() => {
    return () => {
      cleanupStream();
      mediaRecorderRef.current?.stop();
      revokeAudioUrl();
    };
  }, []);

  return {
    status,
    error,
    durationSeconds,
    audioBlob,
    audioUrl,
    mimeType,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
};
