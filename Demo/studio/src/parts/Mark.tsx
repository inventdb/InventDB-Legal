// The firm's mark, the scales, exactly as the app draws it (DeskIntro.tsx),
// with the post drawn first and the beam swinging down to rest.
import { Easing, interpolate } from "remotion";

const ease = Easing.bezier(0.45, 0, 0.2, 1);

export function Mark({ size, color, tone, frame = 999 }: { size: number; color: string; tone?: string; frame?: number }) {
  const post = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const beam = interpolate(frame, [10, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const swing = interpolate(frame, [10, 26, 38, 48], [-14, 6, -2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <svg viewBox="0 0 128 128" width={size} height={size} style={{ display: "block", color, overflow: "visible" }}>
      <g style={{ transform: `scaleY(${post})`, transformOrigin: "64px 117px" }}>
        <circle cx="64" cy="28" r="13.5" fill="currentColor" />
        <path d="M55 41 C57 60 60 86 64 117 C68 86 71 60 73 41 Z" fill="currentColor" />
      </g>
      <g style={{ transform: `rotate(${swing}deg) scaleX(${beam})`, transformOrigin: "64px 50px" }}>
        <path d="M64 46 C50 44 34 40 22 34 L22 41.5 C36 48.5 52 54 64 57 Z" fill="currentColor" />
        <path d="M64 46 C78 44 94 40 106 34 L106 41.5 C92 48.5 76 54 64 57 Z" fill="currentColor" />
        <path d="M22 35 L8 67 L36 67 Z" fill="none" stroke={tone ?? "currentColor"} strokeWidth="5.5" strokeLinejoin="round" />
        <path d="M8 67 A14 14 0 0 0 36 67 Z" fill="currentColor" />
        <path d="M106 35 L92 67 L120 67 Z" fill="none" stroke={tone ?? "currentColor"} strokeWidth="5.5" strokeLinejoin="round" />
        <path d="M92 67 A14 14 0 0 0 120 67 Z" fill="currentColor" />
      </g>
    </svg>
  );
}
