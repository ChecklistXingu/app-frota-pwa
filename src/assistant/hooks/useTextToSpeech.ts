import { useEffect, useRef, useState } from "react";

interface UseTextToSpeechOptions {
  preferredLangs?: string[];
}

export const useTextToSpeech = (
  options: UseTextToSpeechOptions = {},
) => {
  const { preferredLangs = ["pt-BR", "pt_PT", "pt"] } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const synth = window.speechSynthesis;

    const pickVoice = () => {
      const voices = synth.getVoices();
      if (!voices || voices.length === 0) return;

      // Prioriza vozes em português
      const ptVoices = voices.filter((v) =>
        preferredLangs.some((lang) => v.lang?.startsWith(lang)),
      );

      // Entre as vozes em português, tenta escolher uma que pareça feminina pelo nome
      const femaleLikeNames = ["female", "mulher", "woman", "bruna", "maria", "ana", "camila", "marcia", "paula"];
      const preferredPtVoice = ptVoices.find((v) =>
        femaleLikeNames.some((n) => v.name?.toLowerCase().includes(n)),
      ) ?? ptVoices[0];

      const chosen = preferredPtVoice ?? voices[0];
      setVoice(chosen);

      if (chosen) {
        console.log("[Naya TTS] Voz selecionada:", chosen.name, chosen.lang);
      }
    };

    pickVoice();

    if (typeof synth.onvoiceschanged !== "undefined") {
      synth.onvoiceschanged = pickVoice;
    }

    return () => {
      synth.onvoiceschanged = null;
    };
  }, [preferredLangs]);

  const cancel = () => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    setIsSpeaking(false);
    utteranceRef.current = null;
  };

  const speak = (text: string) => {
    if (!isSupported || !text.trim()) return;

    cancel();

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);

    if (voice) {
      utterance.voice = voice;
    }

    // Ajustes sutis para soar menos robótico (depende da voz disponível)
    utterance.rate = 1.05; // ligeiramente mais rápido que o padrão
    utterance.pitch = 1.05; // leve aumento de tom

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  return {
    isSupported,
    isSpeaking,
    voice,
    speak,
    cancel,
  };
};
