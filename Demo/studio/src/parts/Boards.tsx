// The film's own boards, drawn in the app's style: the promise, two
// dashboards side by side, the phones, the architecture and the close.
// Everything enters by moving or being drawn; nothing fades.
import { Easing, Img, interpolate, staticFile } from "remotion";

import { MONO, SANS, SERIF } from "../fonts";
import { C } from "../theme";
import { Mark } from "./Mark";

const ease = Easing.bezier(0.45, 0, 0.2, 1);
const prog = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** Rises into place from below its own line, clipped, so it never fades. */
function Rise({ f, at, children, dist = 1 }: { f: number; at: number; children: React.ReactNode; dist?: number }) {
  const p = prog(f, at, at + 18);
  return (
    <div style={{ overflow: "hidden" }}>
      <div style={{ transform: `translateY(${(1 - p) * 110 * dist}%)` }}>{children}</div>
    </div>
  );
}

const Paper = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(ellipse at 50% 42%, ${C.surface} 0%, ${C.bg} 62%, #ece2d1 100%)`,
      fontFamily: SANS,
      color: C.ink,
    }}
  >
    {children}
  </div>
);

const STAKES = [
  ["A missed deadline", "can become a malpractice claim."],
  ["A trust account error", "can become a State Bar complaint."],
  ["Unbilled time", "is a fee the firm never collects."],
];

/** The three risks a firm carries, set one by one, then the answer. `at` is in seconds. */
export function Stakes({ f, at }: { f: number; at: number[] }) {
  const fps = 30;
  const answer = at[3] * fps;
  const rule = prog(f, answer - 6, answer + 20);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 210, right: 210, top: 250 }}>
        {STAKES.map(([risk, cost], i) => {
          const s = at[i] * fps;
          return (
            <div key={risk} style={{ display: "flex", alignItems: "baseline", gap: 26, marginBottom: 34 }}>
              <div style={{ width: 70, flexShrink: 0, textAlign: "right" }}>
                <Rise f={f} at={s}>
                  <span style={{ fontFamily: SERIF, fontSize: 52, color: C.gold, fontWeight: 500 }}>{["I", "II", "III"][i]}</span>
                </Rise>
              </div>
              <Rise f={f} at={s + 3}>
                <span style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1.18, fontWeight: 600, color: C.ink }}>{risk} </span>
                <span style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1.18, fontWeight: 400, color: C.muted }}>{cost}</span>
              </Rise>
            </div>
          );
        })}
        <div style={{ height: 2, width: 1400 * rule, background: C.gold, margin: "14px 0 34px 96px" }} />
        <div style={{ marginLeft: 96 }}>
          <Rise f={f} at={answer}>
            <span style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 500 }}>
              InventDB Legal is built around <span style={{ fontStyle: "italic", color: C.brand }}>all three.</span>
            </span>
          </Rise>
        </div>
      </div>
    </Paper>
  );
}

/**
 * Two signed-in people's dashboards, side by side and deliberately unlabelled.
 * Each card is tall and shows the left of its page, the sidebar and the first
 * figures, which is where two people's views differ.
 */
export function Pair({ f, a, b, width, height }: { f: number; a: string; b: string; width: number; height: number }) {
  const gap = 34;
  const w = (width - gap * 3) / 2;
  const h = height - gap * 2;
  const pageW = 820; // CSS px of the captured page shown across a card
  const s = w / pageW;
  const pa = prog(f, 0, 22);
  const pb = prog(f, 10, 32);
  const card = (src: string, x: number, p: number) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: gap,
        width: w,
        height: h,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(91,26,36,0.12), 0 18px 40px -18px rgba(64,30,20,0.45)",
        transform: `translateY(${(1 - p) * height}px)`,
      }}
    >
      <Img src={staticFile(`shots/${src}.jpg`)} style={{ position: "absolute", left: 0, top: 0, width: 1600 * s, height: 900 * s }} />
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg }}>
      {card(a, gap, pa)}
      {card(b, gap * 2 + w, pb)}
    </div>
  );
}

export function Phones({ f, srcs, height }: { f: number; srcs: string[]; width: number; height: number }) {
  const ph = height * 0.86;
  const pw = (ph * 390) / 844;
  const bezel = 12;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, display: "flex", justifyContent: "center", alignItems: "center", gap: 70 }}>
      {srcs.map((src, i) => {
        const p = prog(f, i * 8, i * 8 + 24);
        return (
          <div
            key={src}
            style={{
              width: pw + bezel * 2,
              height: ph + bezel * 2,
              borderRadius: 44,
              background: "#211c18",
              padding: bezel,
              boxShadow: "0 24px 50px -22px rgba(40,20,10,0.6)",
              transform: `translateY(${(1 - p) * height}px)`,
            }}
          >
            <div style={{ width: pw, height: ph, borderRadius: 32, overflow: "hidden", background: C.surface }}>
              <Img src={staticFile(`shots/${src}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Box({ f, at, x, y, w, title, lines, tone }: { f: number; at: number; x: number; y: number; w: number; title: string; lines: string[]; tone: "light" | "brand" }) {
  const p = prog(f, at, at + 22);
  const brand = tone === "brand";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        padding: "30px 34px",
        borderRadius: 18,
        background: brand ? C.brand : C.surface,
        color: brand ? "#fbf3e6" : C.ink,
        boxShadow: brand ? "0 22px 44px -20px rgba(71,20,28,0.65)" : "0 0 0 1px rgba(91,26,36,0.1), 0 18px 36px -18px rgba(64,30,20,0.35)",
        transform: `translateY(${(1 - p) * 60}px)`,
        clipPath: `inset(0 0 ${(1 - p) * 100}% 0 round 18px)`,
      }}
    >
      <div style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, lineHeight: 1.15 }}>{title}</div>
      <div style={{ height: 2, width: 64, background: brand ? "#d9b871" : C.gold, margin: "16px 0 18px" }} />
      {lines.map((l) => (
        <div key={l} style={{ fontSize: 23, lineHeight: 1.5, opacity: 1, color: brand ? "#f1e3cc" : C.muted }}>
          {l}
        </div>
      ))}
    </div>
  );
}

function Arrow({ f, at, x1, x2, y, label, token }: { f: number; at: number; x1: number; x2: number; y: number; label: string; token?: boolean }) {
  const p = prog(f, at, at + 20);
  const len = x2 - x1;
  const tp = token ? ((f - at - 26) % 75) / 75 : -1;
  return (
    <>
      <svg style={{ position: "absolute", left: x1, top: y - 14, overflow: "visible" }} width={len} height={28}>
        <line x1={0} y1={14} x2={len * p} y2={14} stroke={C.brand} strokeWidth={3} />
        {p > 0.95 && <path d={`M ${len - 14} 4 L ${len} 14 L ${len - 14} 24`} fill="none" stroke={C.brand} strokeWidth={3} />}
        {token && f > at + 26 && (
          <circle cx={len * Math.max(0, tp)} cy={14} r={7} fill={C.gold} />
        )}
      </svg>
      <div
        style={{
          position: "absolute",
          left: x1,
          width: len,
          top: y + 22,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 19,
          color: C.faint,
          transform: `translateY(${(1 - prog(f, at + 10, at + 28)) * 30}px)`,
          clipPath: `inset(0 0 ${(1 - prog(f, at + 10, at + 28)) * 100}% 0)`,
        }}
      >
        {label}
      </div>
    </>
  );
}

export function Arch({ f, testsAt }: { f: number; testsAt: number }) {
  // Pace the build to the captions: the boxes first, then the token, then tests.
  const fps = 30;
  const tests = Math.round(testsAt * fps);
  const tp = prog(f, tests, tests + 22);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 0, right: 0, top: 96, textAlign: "center" }}>
        <Rise f={f} at={2}>
          <div style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 500 }}>Under the hood</div>
        </Rise>
      </div>
      <Box f={f} at={12} x={150} y={300} w={470} title="React + TypeScript" lines={["The app in the browser", "Dashboard, records, Analyze", "Phones, tablets and desktops"]} tone="light" />
      <Arrow f={f} at={34} x1={640} x2={760} y={420} label="JSON" token />
      <Box f={f} at={40} x={780} y={300} w={390} title="Python API" lines={["A thin layer on Flask", "Validates, searches, adds up", "Stores nothing"]} tone="light" />
      <Arrow f={f} at={62} x1={1190} x2={1310} y={420} label="your token" token />
      <Box f={f} at={68} x={1330} y={300} w={450} title="InventDB SOAR" lines={["The database", "Sign-in and JWTs", "Row-level security", "AI, reports, workflows, files"]} tone="brand" />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 720,
          display: "flex",
          justifyContent: "center",
          gap: 40,
          transform: `translateY(${(1 - tp) * 80}px)`,
          clipPath: `inset(0 0 ${(1 - tp) * 100}% 0)`,
        }}
      >
        {[
          ["1,300+", "backend tests"],
          ["600+", "end-to-end tests"],
        ].map(([n, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "14px 30px", borderRadius: 999, background: C.goldSoft, color: "#7a5c22" }}>
            <span style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 600 }}>{n}</span>
            <span style={{ fontSize: 24, fontWeight: 500 }}>{l}</span>
          </div>
        ))}
      </div>
    </Paper>
  );
}

export function Close({ f }: { f: number }) {
  const rule = prog(f, 40, 70);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Mark size={150} color={C.brand} tone={C.gold} frame={f} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 30 }}>
          <Rise f={f} at={26}>
            <span style={{ fontFamily: SERIF, fontSize: 96, fontWeight: 500, letterSpacing: -1 }}>InventDB</span>
          </Rise>
          <Rise f={f} at={32}>
            <span style={{ fontFamily: SERIF, fontSize: 96, fontWeight: 500, fontStyle: "italic", color: C.brand }}>Legal</span>
          </Rise>
        </div>
        <div style={{ height: 2, width: 560 * rule, background: C.gold, marginTop: 18 }} />
        <Rise f={f} at={56}>
          <div style={{ fontSize: 30, color: C.muted, marginTop: 26, fontWeight: 500 }}>Built on InventDB SOAR · inventdb.com</div>
        </Rise>
      </div>
    </Paper>
  );
}
