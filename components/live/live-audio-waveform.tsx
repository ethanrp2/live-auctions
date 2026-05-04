"use client";

const BARS = 24;

export function LiveAudioWaveform({ muted }: { muted: boolean }) {
  return (
    <div className="flex h-6 items-center gap-[2px]">
      {Array.from({ length: BARS }).map((_, i) => {
        const delay = (i * 80) % 1200;
        return (
          <span
            key={i}
            className={`w-[2px] rounded-full ${muted ? "bg-[#d4d4d4]" : "bg-black"}`}
            style={{
              height: "100%",
              animation: muted
                ? undefined
                : `waveform 1.1s ease-in-out ${delay}ms infinite`,
            }}
          />
        );
      })}
      <style jsx>{`
        @keyframes waveform {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
