import { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { extractVoiceData, formatRecognizedText, type ExtractedData } from "../../utils/voiceDataExtractor";

interface VoiceInputButtonProps {
  onDataExtracted: (data: ExtractedData) => void;
  className?: string;
}

const VoiceInputButton = ({ onDataExtracted, className = "" }: VoiceInputButtonProps) => {
  const {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
  } = useVoiceInput();

  // Quando o transcript mudar, extrai os dados
  useEffect(() => {
    if (transcript) {
      const data = extractVoiceData(transcript);
      onDataExtracted(data);
    }
  }, [transcript, onDataExtracted]);

  if (!isSupported) {
    return null; // Não mostra o botão se não suportar
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        className={`
          w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
          font-semibold text-sm transition-all duration-200
          ${isListening 
            ? "bg-red-500 text-white animate-pulse" 
            : "bg-[#0d2d6c] text-white hover:bg-[#0a2456]"
          }
        `}
      >
        {isListening ? (
          <>
            <MicOff size={20} />
            <span>Escutando... Toque para parar</span>
          </>
        ) : (
          <>
            <Mic size={20} />
            <span>Falar dados</span>
          </>
        )}
      </button>

      {/* Feedback do reconhecimento */}
      {transcript && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
          <p className="font-medium mb-1">✓ Reconhecido:</p>
          <p>{formatRecognizedText(transcript, extractVoiceData(transcript))}</p>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Dica */}
      {!isListening && !transcript && !error && (
        <p className="text-[10px] text-gray-500 text-center">
          Diga: "km 125400, 62 litros, 480 reais"
        </p>
      )}
    </div>
  );
};

export default VoiceInputButton;
