import { useState } from "react";
import { MessageCircle, Mic, Send, Volume2, VolumeX, WifiOff } from "lucide-react";
import VoiceWave from "./VoiceWave";
import { ASSISTANT_NAME, type AssistantMode } from "./config";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useTextToSpeech } from "./hooks/useTextToSpeech";
import { answerQuestion } from "./services/assistantEngine";
import { callNayaBackend } from "./services/nayaBackendClient";
import { useAuth } from "../contexts/AuthContext";
import "./VirtualAssistant.css";

const VirtualAssistant = () => {
  const [mode, setMode] = useState<AssistantMode>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  // posição em coordenadas de tela (left/top) em pixels
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 24, top: 24 });
  const [_isDragging, setIsDragging] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [answersHistory, setAnswersHistory] = useState<string[]>([]);

  const { profile } = useAuth();
  const firstName = profile?.name?.split(" ")[0] ?? "";

  const { start: startListening, stop: stopListening, isSupported: speechSupported, isListening } =
    useSpeechRecognition({
      onResult: (transcript) => {
        setInputValue(transcript);
        setMode("idle");
      },
      onError: (error) => {
        setMessage(error || "Não foi possível usar o microfone.");
        setMode("error");
      },
    });

  const { isSupported: ttsSupported, speak, isSpeaking: ttsIsSpeaking, cancel: stopSpeaking } = useTextToSpeech();
  const shouldAnimateVoice = voiceEnabled && ttsSupported && ttsIsSpeaking;

  const handleToggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  const handleBubbleClick = () => {
    // Se estiver falando, para a voz com clique simples
    if (ttsIsSpeaking && voiceEnabled) {
      stopSpeaking();
      setMode("idle");
    }
    // Se não estiver falando, não faz nada (aguarda duplo clique para abrir)
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.detail > 1) {
      return;
    }

    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setIsDragging(true);

    const handleMouseMove = (e: MouseEvent) => {
      const panelWidth = 320; // largura aproximada do painel da Naya
      const bubbleSize = 80;  // diâmetro aproximado da bolinha
      const margin = 16;

      const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin);
      const maxTop = Math.max(margin, window.innerHeight - bubbleSize - margin);

      setPosition({
        left: Math.max(margin, Math.min(maxLeft, e.clientX - offset.x)),
        top: Math.max(margin, Math.min(maxTop, e.clientY - offset.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || mode === "processing") return;
    setMode("processing");
    setMessage(null);
    const text = inputValue.trim();

    try {
      let answer: string | null = null;

      // Tenta primeiro responder via backend LLM
      answer = await callNayaBackend(text, firstName);

      // Fallback para o motor local caso o backend não responda ou falhe
      if (!answer) {
        answer = await answerQuestion(text, { userName: firstName });
      }

      const finalAnswer = answer ?? "Tive um problema ao processar sua pergunta agora. Tente novamente em alguns instantes.";

      setInputValue("");
      setAnswersHistory((prev) => [finalAnswer, ...prev].slice(0, 10));

      if (voiceEnabled && ttsSupported) {
        setMode("speaking");
        speak(finalAnswer);
      } else {
        setMode("idle");
      }
    } catch (error) {
      console.error("[Naya] Erro ao responder pergunta:", error);
      setAnswersHistory((prev) => [
        "Tive um problema ao consultar os dados agora. Tente novamente em alguns instantes.",
        ...prev,
      ]);
      setMode("error");
    }
  };

  const handleMicClick = () => {
    if (!speechSupported) {
      setMessage("Seu navegador não suporta reconhecimento de voz. Use a digitação.");
      setMode("error");
      return;
    }

    if (isListening) {
      stopListening();
      setMode("idle");
      return;
    }

    setMessage("Ouvindo... fale sua pergunta");
    setMode("listening");
    startListening();
  };

  return (
    <div
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 50,
      }}
    >
      <div className="relative flex flex-col items-end gap-3">
        {isOpen && (
          <div className="naya-gradient-border mb-2 w-80 max-w-[90vw]">
            <div className="naya-panel border border-transparent p-3 text-xs text-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-[color:var(--color-primary)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Assistente
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[color:var(--color-primary)]">
                  {ASSISTANT_NAME}
                </span>
              </div>

            <div className="mb-2 rounded-xl bg-gray-50 border border-gray-100 px-2.5 py-2 text-[11px] text-gray-600">
              Faça uma pergunta sobre sua frota e eu ajudo com base nos dados do sistema.
            </div>

            {answersHistory.length > 0 && (
              <div className="mb-2 space-y-1 max-h-40 overflow-y-auto">
                {answersHistory.map((answer, index) => (
                  <div
                    key={index}
                    className="rounded-xl bg-white border border-gray-100 px-2.5 py-2 text-[11px] text-gray-700"
                  >
                    {answer}
                  </div>
                ))}
              </div>
            )}

            {message && (
              <div className="mb-2 flex items-start gap-1.5 rounded-xl bg-orange-50 border border-orange-200 px-2.5 py-1.5 text-[11px] text-orange-700">
                <WifiOff size={12} className="mt-[2px] flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={handleMicClick}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-[color:var(--color-primary)] transition ${
                  mode === "listening" || isListening
                    ? "bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)]"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <Mic size={16} />
              </button>

              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Digite sua pergunta..."
                className="flex-1 rounded-full border border-gray-300 px-3 py-1.5 text-[11px] outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]"
              />

              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white shadow hover:bg-[color:var(--color-primary)]/90"
              >
                <Send size={14} />
              </button>
            </form>

            {answersHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setAnswersHistory([])}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] text-gray-600 hover:bg-gray-50"
              >
                <span>Limpar conversa</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setVoiceEnabled((prev) => !prev)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] text-gray-600 hover:bg-gray-50"
            >
              {voiceEnabled ? (
                <>
                  <Volume2 size={12} />
                  <span>Resposta por voz</span>
                </>
              ) : (
                <>
                  <VolumeX size={12} />
                  <span>Somente texto</span>
                </>
              )}
            </button>
            </div>
          </div>
        )}

        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleToggleOpen}
          onClick={handleBubbleClick}
          className={`cursor-pointer select-none ${ttsIsSpeaking && voiceEnabled ? 'cursor-pointer' : 'cursor-grab'} active:cursor-grabbing`}
          title={ttsIsSpeaking && voiceEnabled ? "Clique para parar a voz" : "Duplo clique para abrir"}
        >
          <div
            className={`naya-bubble-border${shouldAnimateVoice ? " naya-bubble-border--speaking" : ""}`}
          >
            <div className={`naya-bubble-core${shouldAnimateVoice ? " naya-bubble-core--speaking" : ""}`}>
              <VoiceWave mode={mode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualAssistant;
