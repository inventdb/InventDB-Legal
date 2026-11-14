// Both films. App footage sits in a window with a slim title bar naming the
// chapter; the opening, the promise, the architecture and the close fill the
// frame. Shots change by sliding, the window grows and shrinks by moving, and
// subtitles rise into place. Nothing fades.
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";

import { MONO, SANS } from "./fonts";
import { Arch, Close, Pair, Phones, Stakes } from "./parts/Boards";
import { IntroView, MARKS } from "./parts/IntroView";
import { Mark } from "./parts/Mark";
import { ShotView } from "./parts/ShotView";
import { C, EASE, FPS, FRAME, H, W } from "./theme";
import { layout, type Placed, type Seg } from "./timeline";

const ease = Easing.bezier(...EASE);
const SLIDE = 16; // frames a shot takes to slide in
const MORPH = 22; // frames the window takes to grow or shrink

const framed = (s: Seg) => s.kind === "shot" || s.kind === "pair" || s.kind === "phones";
const sameView = (a: Seg | undefined, b: Seg) =>
  !!a && ((a.kind === "shot" && b.kind === "shot" && a.src === b.src) || (a.kind === "intro" && b.kind === "shot" && b.src.startsWith("dash")));

/** The content box: 0 = the whole frame, 1 = inside the window. */
function box(p: number) {
  // Both ends are 16:9 (1920 x 1080 and 1540 x 866), so one ratio holds throughout.
  const w = W - 2 * FRAME.x * p;
  return { x: FRAME.x * p, y: (FRAME.y + FRAME.title) * p, w, h: (w * H) / W };
}

function Content({ seg, local, frames, w, h }: { seg: Seg; local: number; frames: number; w: number; h: number }) {
  switch (seg.kind) {
    case "shot":
      return <ShotView src={seg.src} cam={seg.cam} marks={seg.marks} width={w} height={h} frame={local} frames={frames} />;
    case "intro": {
      const base = seg.from === "start" ? (seg.skip ?? 0) * 1000 : MARKS.form - 700;
      return <IntroView ms={base + (local / FPS) * 1000} />;
    }
    case "stakes":
      return <Stakes f={local} at={seg.at} />;
    case "pair":
      return <Pair f={local} a={seg.a} b={seg.b} width={w} height={h} />;
    case "phones":
      return <Phones f={local} srcs={seg.srcs} width={w} height={h} />;
    case "arch":
      return <Arch f={local} testsAt={seg.testsAt} />;
    case "close":
      return <Close f={local} />;
  }
}

function Captions({ caps, frame }: { caps: { text: string; start: number; end: number }[]; frame: number }) {
  const t = frame / FPS;
  const c = caps.find((k) => t >= k.start && t < k.end - 0.08);
  if (!c) return null;
  const local = frame - c.start * FPS;
  const p = interpolate(local, [0, 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 1000 }}>
      <div style={{ overflow: "hidden", borderRadius: 14 }}>
        <div
          style={{
            transform: `translateY(${(1 - p) * 100}%)`,
            maxWidth: 1420,
            padding: "12px 30px 14px",
            borderRadius: 14,
            background: "rgba(28, 25, 22, 0.9)",
            color: "#fffdf9",
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: 37,
            lineHeight: 1.32,
            textAlign: "center",
            letterSpacing: 0.1,
          }}
        >
          {c.text}
        </div>
      </div>
    </div>
  );
}

function TitleBar({ p, chapter, prevChapter, sinceChange, w }: { p: number; chapter?: string; prevChapter?: string; sinceChange: number; w: number }) {
  const k = interpolate(sinceChange, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const label = (text: string | undefined, y: number) =>
    text ? (
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: FRAME.title, display: "flex", alignItems: "center", justifyContent: "center", transform: `translateY(${y}px)` }}>
        <span style={{ fontFamily: SANS, fontSize: 19, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", color: C.brand }}>{text}</span>
      </div>
    ) : null;
  return (
    <div
      style={{
        position: "absolute",
        left: FRAME.x * p,
        top: FRAME.y * p - FRAME.title * (1 - p),
        width: w,
        height: FRAME.title,
        background: C.surface2,
        borderBottom: `1px solid ${C.line}`,
        borderRadius: "14px 14px 0 0",
        overflow: "hidden",
        zIndex: 900,
      }}
    >
      <div style={{ position: "absolute", left: 18, top: 0, height: FRAME.title, display: "flex", alignItems: "center", gap: 10 }}>
        <Mark size={24} color={C.brand} tone={C.gold} />
        <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600, color: C.ink }}>InventDB Legal</span>
      </div>
      {chapter !== prevChapter && label(prevChapter, -FRAME.title * k)}
      {label(chapter, chapter !== prevChapter ? FRAME.title * (1 - k) : 0)}
      <div style={{ position: "absolute", right: 18, top: 0, height: FRAME.title, display: "flex", alignItems: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 15, color: C.faint }}>Demo data · a fictional firm</span>
      </div>
    </div>
  );
}

export function Film({ cut }: { cut: "long" | "short" }) {
  const frame = useCurrentFrame();
  const { segs, caps } = layout(cut);

  const placed = segs.map((s) => ({ ...s, f0: Math.round(s.start * FPS), f1: Math.round(s.end * FPS) }));
  const idx = Math.max(0, placed.findIndex((s) => frame >= s.f0 && frame < s.f1));
  const cur = placed[idx];
  const prev = placed[idx - 1];

  // The window: grows to fill the frame, or shrinks back, as the kind of shot changes.
  const want = framed(cur.seg) ? 1 : 0;
  const had = prev ? (framed(prev.seg) ? 1 : 0) : want;
  const p = interpolate(frame - cur.f0, [0, MORPH], [had, want], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const b = box(p);

  // The chapter in the title bar, and when it last changed.
  let j = idx;
  while (j > 0 && placed[j - 1].chapter === cur.chapter) {
    j--;
  }
  const since = frame - placed[j].f0;
  const prevChapter = j > 0 ? placed[j - 1].chapter : undefined;

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${C.surface} 0%, ${C.bg} 60%, #e9dfcc 100%)` }} />

      {/* The window's shadow and frame, behind the footage. */}
      {p > 0 && (
        <div
          style={{
            position: "absolute",
            left: b.x,
            top: FRAME.y * p,
            width: b.w,
            height: b.h + FRAME.title * p,
            borderRadius: 14 * p,
            background: C.surface,
            boxShadow: `0 0 0 1px rgba(91,26,36,${0.14 * p}), 0 30px 60px -28px rgba(64,30,20,${0.5 * p})`,
          }}
        />
      )}

      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden", borderRadius: `0 0 ${14 * p}px ${14 * p}px`, zIndex: 1, isolation: "isolate" }}>
        {placed.map((s: Placed & { f0: number; f1: number }, i) => {
          const next = placed[i + 1];
          const slideOut = next && !sameView(s.seg, next.seg) ? SLIDE : 0;
          if (frame < s.f0 || frame >= s.f1 + slideOut) return null;
          const local = frame - s.f0;
          const len = s.f1 - s.f0;
          const before = placed[i - 1];
          const slideIn = before && !sameView(before.seg, s.seg) ? SLIDE : 0;
          let tx = 0;
          if (slideIn && local < slideIn) tx = b.w * (1 - ease(local / slideIn));
          if (local >= len) tx = -b.w * 0.3 * ease(Math.min(1, (local - len) / SLIDE));
          return (
            <div key={i} style={{ position: "absolute", inset: 0, transform: `translateX(${tx}px)`, zIndex: i }}>
              <Content seg={s.seg} local={Math.min(local, len)} frames={len} w={b.w} h={b.h} />
            </div>
          );
        })}
      </div>

      {p > 0 && <TitleBar p={p} chapter={cur.chapter} prevChapter={prevChapter} sinceChange={since} w={b.w} />}

      <Captions caps={caps} frame={frame} />
      <Audio src={staticFile(cut === "long" ? "music-5min.wav" : "music-3min.wav")} volume={0.5} />
    </AbsoluteFill>
  );
}

