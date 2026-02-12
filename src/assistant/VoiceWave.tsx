import type { FC } from "react";
import type { AssistantMode } from "./config";

interface VoiceWaveProps {
  mode: AssistantMode;
}

const VoiceWave: FC<VoiceWaveProps> = ({ mode }) => {
  const scaleClass =
    mode === "speaking"
      ? "animate-pulse-fast scale-110"
      : mode === "listening" || mode === "processing"
      ? "animate-pulse-medium scale-105"
      : "animate-pulse-slow";

  return (
    <div className="relative flex items-center justify-center">
      <div
        className={`h-14 w-14 rounded-full bg-[color:var(--color-primary)] shadow-lg transition-transform ${scaleClass}`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/40" />
    </div>
  );
};

export default VoiceWave;
