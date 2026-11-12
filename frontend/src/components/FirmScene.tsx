/**
 * FirmScene — the firm drawn as an architect's section, on the login page and
 * the dashboard banner.
 *
 * The whole practice lives inside one building, cut open so every floor shows.
 * The floors are named the way a firm would name its rooms rather than its
 * software — the Enquiry Room, the Parlour, Chambers, Clockwork, the
 * Strongroom, the Watch, the Archive and the Observatory — each with a line of
 * script that hints at what happens there, and a small hand-drawn scene in its
 * first bay. A lift travels the core, rooms light and dim, the clock keeps
 * time, the vault wheel turns, the revolving door turns, the telescope sweeps.
 * The courthouse stands a little way off.
 *
 * On login the sheet is drafted in front of you — lines draw on, the lobby and
 * then each floor light up, and a leader runs out of the lobby to the sign-in
 * sheet, which arrives last (its timing is in global.css). The layers carry a
 * depth (`--z`) that the login page turns into parallax as the pointer moves.
 * On the dashboard every floor, and the courthouse, is a link to its module.
 *
 * Inline SVG throughout, every colour an `--f-*` token from firm.css, so the
 * drawing follows the time of day and the theme.
 */
import {
  memo,
  useId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { ENTITY_BY_NAME } from "../config/entities";

export type Sky = "morning" | "afternoon" | "evening";

/**
 * Time of day in the reader's own timezone — the boundaries the dashboard
 * greeting uses. Evening starts at 4pm: later than that "good afternoon"
 * reads as a clock that is wrong, which was reported as a bug.
 */
export function timeOfDay(now: Date = new Date()): Sky {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 16) return "afternoon";
  return "evening";
}

/* ── Measurements, in viewBox units (the sheet is 1800 × 1000) ────────────
   The firm stands at x 660 → 1140 on a ground line at y 880. The core on the
   left of each floor carries its name and script, with the lift shaft at its
   inner edge; four bays fill the rest, the first holding the floor's scene.
   The lobby's mid-height (y 825) is where the leader to the sign-in sheet
   leaves the building — global.css hangs the sheet from that same line. */
const FX0 = 660;
const FX1 = 1140;
const W = FX1 - FX0;
const CORE = 160;
const SHAFT = FX0 + CORE - 22;
const BAY0 = FX0 + CORE;
const BAYS = 4;
const BAY_W = (FX1 - BAY0) / BAYS;
const GROUND = 880;
const LOBBY_TOP = 780;
const FLOOR_H = 54;
const ROOF = LOBBY_TOP - 8 * FLOOR_H; // 348
export const LEADER_Y = 825;

/** Storey heights, for the level markers: a 4.2 m lobby, then 3.6 m floors. */
const level = (k: number) => 4.2 + k * 3.6;
const fmtLevel = (m: number) => `+${m.toFixed(2).padStart(5, "0")}`;

/** Stable pseudo-random 0..1008, so nothing reshuffles between renders. */
const hash = (n: number) => (Math.imul(n * 7919 + 13, 0x9e3779b1) >>> 0) % 1009;

const css = (o: Record<string, string | number>) => o as CSSProperties;
const delay = (ms: number) => css({ "--d": `${ms}ms` });
/** A rotation pivot, in user units. */
const pivot = (x: number, y: number) => css({ transformOrigin: `${x}px ${y}px` });

/* ── The scenes, one per floor, drawn into a bay ───────────────────────── */

type Box = { x: number; y: number; w: number; h: number };

/** A standing or seated figure: head and shoulders, feet at `yb`. */
function Figure({ x, yb, tall = 1 }: { x: number; yb: number; tall?: number }) {
  const body = 14 * tall;
  return (
    <>
      <circle cx={x} cy={yb - body - 4.5} r={3.6} />
      <path d={`M${x - 4.6},${yb} l0.8,-${body - 4} a3.8,3.8 0 0 1 7.6,0 l0.8,${body - 4} Z`} />
    </>
  );
}

function Enquiry({ x, y, w, h }: Box) {
  const yb = y + h;
  const cx = x + w / 2;
  return (
    <>
      <Figure x={x + 15} yb={yb - 2} />
      <Figure x={x + w - 15} yb={yb - 2} />
      <rect x={cx - 12} y={yb - 14} width={24} height={2.4} />
      <rect x={cx - 1} y={yb - 12} width={2} height={12} />
      <path
        className="ink-line talk"
        d={`M${cx - 9},${y + 7} h18 a3,3 0 0 1 3,3 v5 a3,3 0 0 1 -3,3 h-9 l-4,4 v-4 h-5 a3,3 0 0 1 -3,-3 v-5 a3,3 0 0 1 3,-3 Z`}
      />
    </>
  );
}

function Parlour({ x, y, w, h }: Box) {
  const yb = y + h;
  return (
    <>
      <rect x={x + 30} y={y + 6} width={14} height={10} className="ink-line" />
      <path
        d={`M${x + 8},${yb} v-13 a3,3 0 0 1 3,-3 h3 v-7 a3,3 0 0 1 3,-3 h14 a3,3 0 0 1 3,3 v7 h3 a3,3 0 0 1 3,3 v13 h-3 v-4 h-26 v4 Z`}
      />
      <circle cx={x + 24} cy={yb - 27} r={3.6} className="lamp-face" />
      <line x1={x + w - 13} x2={x + w - 13} y1={yb} y2={y + 15} className="ink-line" />
      <path d={`M${x + w - 20},${y + 15} h14 l-3,-8 h-8 Z`} />
      <rect x={x + w - 17} y={yb - 2} width={8} height={2} />
    </>
  );
}

function Chambers({ x, y, w, h }: Box) {
  const yb = y + h;
  return (
    <>
      <line x1={x + w / 2 - 12} x2={x + w / 2 - 12} y1={y} y2={y + 7} className="ink-line" />
      <path d={`M${x + w / 2 - 18},${y + 12} h12 l-3,-5 h-6 Z`} />
      <rect x={x + 6} y={yb - 13} width={40} height={2.4} />
      <rect x={x + 8} y={yb - 11} width={2} height={11} />
      <rect x={x + 42} y={yb - 11} width={2} height={11} />
      <rect x={x + 10} y={yb - 19} width={15} height={6} />
      <rect x={x + 12} y={yb - 25} width={13} height={6} className="ink-line" />
      <rect x={x + 28} y={yb - 18} width={12} height={5} className="ink-line" />
      <Figure x={x + w - 14} yb={yb} tall={1.2} />
      <rect x={x + w - 25} y={yb - 25} width={6} height={8} className="ink-line" />
    </>
  );
}

function Clockwork({ x, y, w, h }: Box) {
  const yb = y + h;
  const cx = x + 22;
  const cy = y + 20;
  return (
    <>
      <circle cx={cx} cy={cy} r={14} className="ink-line heavy" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r0 = i % 3 === 0 ? 9.5 : 11;
        return (
          <line
            key={i}
            x1={cx + Math.sin(a) * r0}
            y1={cy - Math.cos(a) * r0}
            x2={cx + Math.sin(a) * 12.5}
            y2={cy - Math.cos(a) * 12.5}
            className="ink-line"
          />
        );
      })}
      <line x1={cx} y1={cy} x2={cx} y2={cy - 10} className="ink-line heavy hand-m" style={pivot(cx, cy)} />
      <line x1={cx} y1={cy} x2={cx + 6.5} y2={cy} className="ink-line heavy hand-h" style={pivot(cx, cy)} />
      <circle cx={cx} cy={cy} r={1.8} />
      <rect x={x + 10} y={yb - 3} width={24} height={3} />
      <path d={`M${x + w - 24},${y + 10} h12 l-6,9 l6,9 h-12 l6,-9 Z`} className="ink-line" />
      <path d={`M${x + w - 21},${y + 25} h6 l-3,-4 Z`} />
      <rect x={x + w - 26} y={y + 7} width={16} height={2.5} />
      <rect x={x + w - 26} y={y + 28} width={16} height={2.5} />
      <rect x={x + w - 30} y={yb - 9} width={24} height={2.4} />
      <circle cx={x + w - 18} cy={yb - 16} r={3.4} />
    </>
  );
}

function Strongroom({ x, y, w, h }: Box) {
  const cx = x + 26;
  const cy = y + h / 2 + 1;
  return (
    <>
      <circle cx={cx} cy={cy} r={18} className="ink-line heavy" />
      <circle cx={cx} cy={cy} r={13} className="ink-line" />
      <rect x={cx - 21} y={cy - 9} width={3} height={6} />
      <rect x={cx - 21} y={cy + 3} width={3} height={6} />
      <g className="wheel" style={pivot(cx, cy)}>
        {[0, 60, 120].map((a) => (
          <line
            key={a}
            x1={cx - Math.cos((a * Math.PI) / 180) * 9}
            y1={cy - Math.sin((a * Math.PI) / 180) * 9}
            x2={cx + Math.cos((a * Math.PI) / 180) * 9}
            y2={cy + Math.sin((a * Math.PI) / 180) * 9}
            className="ink-line heavy"
          />
        ))}
        <circle cx={cx} cy={cy} r={2.6} />
      </g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={x + w - 25 + (i % 3) * 7}
          y={y + 9 + Math.floor(i / 3) * 10}
          width={5.5}
          height={8}
          className={i === 4 ? undefined : "ink-line"}
        />
      ))}
    </>
  );
}

function Watch({ x, y, w, h }: Box) {
  const yb = y + h;
  const gx = x + 7;
  const gy = y + 7;
  return (
    <>
      <rect x={gx} y={gy} width={36} height={30} className="ink-line" />
      <rect x={gx} y={gy} width={36} height={6} />
      {[1, 2, 3].map((c) => (
        <line key={c} x1={gx + c * 9} x2={gx + c * 9} y1={gy + 6} y2={gy + 30} className="ink-line" />
      ))}
      {[1, 2].map((r) => (
        <line key={r} x1={gx} x2={gx + 36} y1={gy + 6 + r * 8} y2={gy + 6 + r * 8} className="ink-line" />
      ))}
      <rect x={gx + 19.5} y={gy + 15.5} width={6} height={5} className="mark" />
      <Figure x={x + w - 14} yb={yb} tall={1.15} />
      <line x1={x + w - 18} y1={yb - 19} x2={gx + 30} y2={gy + 20} className="ink-line heavy" />
    </>
  );
}

function Archive({ x, y, w, h }: Box) {
  const yb = y + h;
  const shelves = [x + 6, x + 32];
  return (
    <>
      {shelves.map((sx, s) => (
        <g key={sx}>
          <rect x={sx} y={y + 4} width={22} height={h - 4} className="ink-line" />
          {[0, 1, 2, 3].map((r) => {
            const ry = y + 4 + (r + 1) * 10.5;
            let bx = sx + 1.5;
            const boxes: ReactNode[] = [];
            for (let i = 0; i < 4 && bx < sx + 19; i++) {
              const bw = 2.5 + (hash(s * 31 + r * 7 + i) % 3);
              boxes.push(<rect key={i} x={bx} y={ry - 8} width={bw} height={8} />);
              bx += bw + 1.2;
            }
            return (
              <g key={r}>
                {boxes}
                <line x1={sx} x2={sx + 22} y1={ry} y2={ry} className="ink-line" />
              </g>
            );
          })}
        </g>
      ))}
      <line x1={x + w - 13} y1={yb} x2={x + w - 8} y2={y + 4} className="ink-line heavy" />
      <line x1={x + w - 5} y1={yb} x2={x + w - 1} y2={y + 4} className="ink-line heavy" />
      {[0, 1, 2, 3].map((r) => (
        <line key={r} x1={x + w - 12 + r * 1.1} x2={x + w - 4 + r * 0.9} y1={yb - 8 - r * 9} y2={yb - 8 - r * 9} className="ink-line" />
      ))}
    </>
  );
}

function Observatory({ x, y, w, h }: Box) {
  const yb = y + h;
  const px = x + w - 26;
  const py = yb - 18;
  return (
    <>
      <polyline
        points={`${x + 6},${y + 18} ${x + 12},${y + 13} ${x + 17},${y + 15} ${x + 23},${y + 8} ${x + 28},${y + 10}`}
        className="ink-line heavy"
      />
      <line x1={x + 6} x2={x + 30} y1={y + 21} y2={y + 21} className="ink-line" />
      <Figure x={x + 14} yb={yb} />
      <line x1={px} y1={py} x2={px - 9} y2={yb} className="ink-line heavy" />
      <line x1={px} y1={py} x2={px + 9} y2={yb} className="ink-line heavy" />
      <line x1={px} y1={py} x2={px} y2={yb} className="ink-line" />
      <g className="scope" style={pivot(px, py)}>
        <g transform={`rotate(-34 ${px} ${py})`}>
          <rect x={px - 10} y={py - 3.5} width={30} height={7} rx={1.5} />
          <rect x={px + 20} y={py - 5} width={4} height={10} />
          <rect x={px - 14} y={py - 2} width={4} height={4} />
        </g>
      </g>
    </>
  );
}

/* ── The floors ──────────────────────────────────────────────────────────── */

interface Floor {
  id: string;
  /** What the floor is called in the building. */
  name: string;
  /** A line that hints at what happens there, without spelling it out. */
  script: string;
  module: string;
  to: string;
  Scene: (b: Box) => ReactNode;
}

const entity = (name: string) => ({
  module: ENTITY_BY_NAME[name]?.labelPlural ?? name,
  to: `/${name}`,
});

/** Bottom to top. */
const FLOORS: Floor[] = [
  { id: "intake", name: "Enquiry Room", script: "first words, first heard", ...entity("intake_and_leads"), Scene: Enquiry },
  { id: "clients", name: "The Parlour", script: "where clients are known", ...entity("clients"), Scene: Parlour },
  { id: "matters", name: "Chambers", script: "where cases take shape", ...entity("matters"), Scene: Chambers },
  { id: "billing", name: "Clockwork", script: "every hour, honoured", module: "Time & Billing", to: "/time_entries", Scene: Clockwork },
  { id: "trust", name: "Strongroom", script: "held in trust, untouched", ...entity("trust_ledger_cta"), Scene: Strongroom },
  { id: "docket", name: "The Watch", script: "no date slips past", ...entity("deadlines_and_sol"), Scene: Watch },
  { id: "records", name: "Archive", script: "every page, kept", module: "Files", to: "/files", Scene: Archive },
  { id: "reports", name: "Observatory", script: "the practice, seen whole", module: "Reports", to: "/reports", Scene: Observatory },
];

const LOBBY = { name: "Threshold", script: "every visit begins here" };
const COURT = { id: "court", name: "The Court", script: "where the calendar leads", ...entity("court_calendar") };

/** The building, floor by floor, for a screen-reader list on login. */
export const FIRM_FEATURES = [
  `${LOBBY.name} — ${LOBBY.script}`,
  ...FLOORS.map((f) => `${f.name} — ${f.script} (${f.module})`),
  `${COURT.name} — ${COURT.script} (${COURT.module})`,
];

/** The drafting sequence, in ms: lines, then lights from the lobby up. */
const LOBBY_AT = 900;
const floorAt = (k: number) => 1050 + k * 130;

/* ── Furniture for the other bays ───────────────────────────────────────── */

/**
 * `v` picks the furniture. It steps across the floors rather than being
 * random, so no two neighbouring bays repeat and each floor has about one
 * room dark.
 */
function Bay({ x, y, w, h, seed, v }: Box & { seed: number; v: number }) {
  const yb = y + h;
  if (v === 5) return <rect x={x} y={y} width={w} height={h} className="room off ln-thin" pathLength={1} />;
  // About one lit room in four comes and goes, on its own slow clock.
  const flux = hash(seed + 5) % 4 === 0;
  const style = flux
    ? css({ "--fx": `${14 + (hash(seed + 9) % 16)}s`, "--fd": `${3 + (hash(seed + 11) % 9)}s` })
    : undefined;
  return (
    <g className={flux ? "bay flux" : "bay"} style={style}>
      <rect x={x} y={y} width={w} height={h} className="room lit" />
      <g className="ink lit">
        {v === 0 && (
          <>
            <rect x={x + 8} y={yb - 13} width={w - 16} height={2.4} />
            <rect x={x + w * 0.58} y={yb - 22} width={13} height={9} />
            <Figure x={x + w * 0.34} yb={yb - 11} tall={0.75} />
          </>
        )}
        {v === 1 && (
          <>
            <rect x={x + 7} y={y + 8} width={w * 0.36} height={h - 8} className="ink-line" />
            <line x1={x + 7} x2={x + 7 + w * 0.36} y1={y + 19} y2={y + 19} className="ink-line" />
            <line x1={x + 7} x2={x + 7 + w * 0.36} y1={y + 30} y2={y + 30} className="ink-line" />
            <Figure x={x + w * 0.72} yb={yb} tall={1.2} />
          </>
        )}
        {v === 2 && (
          <>
            <rect x={x + w * 0.22} y={yb - 12} width={w * 0.56} height={2.4} />
            <Figure x={x + w * 0.2} yb={yb - 10} tall={0.7} />
            <Figure x={x + w * 0.8} yb={yb - 10} tall={0.7} />
          </>
        )}
        {v === 3 && (
          <>
            <circle cx={x + w - 18} cy={yb - 18} r={7} className="ink-line" />
            <line x1={x + w - 18} x2={x + w - 18} y1={yb - 11} y2={yb} className="ink-line" />
            <rect x={x + 8} y={yb - 13} width={30} height={2.4} />
            <Figure x={x + 22} yb={yb - 11} tall={0.75} />
          </>
        )}
        {v === 4 && (
          <>
            <rect x={x + 10} y={y + 9} width={22} height={14} className="ink-line" />
            <line x1={x + 13} x2={x + 29} y1={y + 19} y2={y + 13} className="ink-line" />
            <Figure x={x + w - 22} yb={yb} tall={1.15} />
          </>
        )}
      </g>
    </g>
  );
}

/* ── The street ─────────────────────────────────────────────────────────── */

function Tree({ x, s = 1 }: { x: number; s?: number }) {
  return (
    <g className="deco">
      <line x1={x} x2={x} y1={GROUND} y2={GROUND - 30 * s} className="trunk" />
      <circle cx={x} cy={GROUND - 46 * s} r={18 * s} className="canopy" />
      <circle cx={x + 6 * s} cy={GROUND - 51 * s} r={9 * s} className="canopy-hi" />
    </g>
  );
}

function Lamp({ x }: { x: number }) {
  return (
    <g className="deco">
      <line x1={x} x2={x} y1={GROUND} y2={GROUND - 66} className="post" />
      <line x1={x} x2={x + 12} y1={GROUND - 66} y2={GROUND - 66} className="post" />
      <rect x={x + 6} y={GROUND - 65} width={7} height={3} className="lamp" />
    </g>
  );
}

function Passerby({ x, tall = 1 }: { x: number; tall?: number }) {
  return (
    <g className="deco passer">
      <Figure x={x} yb={GROUND} tall={tall * 1.7} />
    </g>
  );
}

/** The scales of justice, drawn rather than borrowed from an icon set. */
function Scales({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g className="emblem" transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1={0} y1={-7} x2={0} y2={7} />
      <line x1={-4} y1={7} x2={4} y2={7} />
      <line x1={-10} y1={-4.5} x2={10} y2={-4.5} />
      <circle cx={0} cy={-8.5} r={1.4} />
      <path d="M-10,-4.5 L-13,2 M-10,-4.5 L-7,2 M-14,2 Q-10,5.5 -6,2" />
      <path d="M10,-4.5 L7,2 M10,-4.5 L13,2 M6,2 Q10,5.5 14,2" />
    </g>
  );
}

/** Two skylines behind the street: a far, hazed one and a nearer one. */
const FAR1: [number, number, number][] = [
  [0, 90, 300], [96, 60, 220], [160, 110, 360], [276, 70, 260], [352, 90, 410], [448, 64, 300],
  [520, 120, 380], [1180, 90, 340], [1276, 70, 420], [1352, 120, 300], [1478, 66, 380],
  [1550, 100, 330], [1656, 70, 260], [1732, 68, 360],
];
const FAR2: [number, number, number][] = [
  [20, 70, 150], [420, 64, 210], [490, 52, 170], [548, 84, 250], [1190, 76, 200],
  [1272, 110, 270], [1388, 60, 180], [1454, 96, 240], [1556, 70, 160], [1632, 90, 220], [1728, 72, 180],
];
const STARS = Array.from({ length: 70 }, (_, k) => ({
  x: (hash(k + 400) / 1009) * 1800,
  y: (hash(k + 900) / 1009) * 470,
  r: 0.6 + (hash(k + 50) % 3) * 0.45,
  d: (hash(k + 7) % 50) * 120,
}));

/** The courthouse, a little way off. */
function Courthouse() {
  const cx = 245;
  const cols = [0, 1, 2, 3, 4, 5].map((i) => 146 + i * 39);
  return (
    <g className="court-drawing">
      <rect x={92} y={798} width={48} height={82} className="c-fill ln-thin" pathLength={1} />
      <rect x={350} y={798} width={48} height={82} className="c-fill ln-thin" pathLength={1} />
      {[104, 122, 362, 380].map((x) => (
        <rect key={x} x={x} y={814} width={8} height={18} className="room lit" />
      ))}
      <rect x={205} y={682} width={80} height={62} className="c-fill ln-thin" pathLength={1} />
      {[217, 235, 253, 271].map((x) => (
        <rect key={x} x={x - 3} y={694} width={6} height={16} className="room lit" />
      ))}
      <path d="M201,682 A44,50 0 0 1 289,682 Z" className="dome ln-thin" pathLength={1} />
      <rect x={240} y={622} width={10} height={12} className="c-fill ln-thin" pathLength={1} />
      <line x1={245} x2={245} y1={622} y2={586} className="ln-thin" pathLength={1} />
      <path d="M245,586 L266,588 L266,598 L245,596 Z" className="flag" />
      <rect x={130} y={772} width={230} height={84} className="c-recess" />
      {cols.map((x) => (
        <rect key={x} x={x} y={772} width={12} height={84} className="c-fill ln-thin" pathLength={1} />
      ))}
      <rect x={233} y={804} width={24} height={52} className="room lit" />
      <rect x={124} y={756} width={242} height={16} className="c-fill ln-thin" pathLength={1} />
      <polygon points={`118,757 372,757 ${cx},712`} className="c-fill ln-thin" pathLength={1} />
      <polygon points={`142,752 348,752 ${cx},722`} className="ln-thin" pathLength={1} />
      <Scales x={cx} y={741} s={0.9} />
      <rect x={122} y={856} width={246} height={8} className="c-fill ln-thin" pathLength={1} />
      <rect x={112} y={864} width={266} height={8} className="c-fill ln-thin" pathLength={1} />
      <rect x={100} y={872} width={290} height={8} className="c-fill ln-thin" pathLength={1} />
      {/* named beside the dome, in open sky clear of the page's copy */}
      <line x1={292} x2={310} y1={668} y2={656} className="ln-thin" pathLength={1} />
      <text x={314} y={652} className="court-name">
        {COURT.name.toUpperCase()}
      </text>
      <text x={314} y={670} className="script">
        {COURT.script}
      </text>
    </g>
  );
}

/* ── The sheet ──────────────────────────────────────────────────────────── */

type Target = { id: string; module: string; to: string; where: string };

function FirmSceneImpl({ variant, sky }: { variant: "hero" | "banner"; sky: Sky }) {
  const navigate = useNavigate();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const interactive = variant === "banner";
  const [active, setActive] = useState<Target | null>(null);

  /** Hover and focus wiring for a floor or the courthouse. */
  const target = (t: Target) => ({
    onMouseEnter: () => setActive(t),
    onMouseLeave: () => setActive(null),
    ...(interactive
      ? {
          role: "link",
          tabIndex: 0,
          "aria-label": `${t.module} — ${t.where}`,
          onClick: () => navigate(t.to),
          onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(t.to);
            }
          },
          onFocus: () => setActive(t),
          onBlur: () => setActive(null),
        }
      : {}),
  });

  const floors: ReactNode[] = FLOORS.map((f, k) => {
    const bottom = LOBBY_TOP - k * FLOOR_H;
    const top = bottom - FLOOR_H;
    const gy = top + 2;
    const gh = FLOOR_H - 7;
    const t: Target = { id: f.id, module: f.module, to: f.to, where: f.name };
    const first: Box = { x: BAY0 + 3, y: gy, w: BAY_W - 6, h: gh };
    return (
      <g
        key={f.id}
        className={`floor${active?.id === f.id ? " is-active" : ""}`}
        data-floor={f.id}
        style={delay(floorAt(k))}
        {...target(t)}
      >
        <text x={FX0 + 14} y={gy + 12} className="core-num lit">
          {`L${String(k + 1).padStart(2, "0")}`}
        </text>
        <text x={FX0 + 14} y={gy + 27} className="core-name lit">
          {f.name}
        </text>
        <text x={FX0 + 14} y={gy + 42} className="script lit">
          {f.script}
        </text>
        {/* the floor's own scene, in the first bay */}
        <rect x={first.x} y={first.y} width={first.w} height={first.h} className="room lit" />
        <g className="ink lit">{f.Scene(first)}</g>
        {Array.from({ length: BAYS - 1 }, (_, i) => {
          const b = i + 1;
          return (
            <Bay
              key={b}
              x={BAY0 + b * BAY_W + 3}
              y={gy}
              w={BAY_W - 6}
              h={gh}
              seed={k * 11 + b}
              v={(k * 5 + b * 2) % 6}
            />
          );
        })}
        {/* level marker */}
        <g className="level">
          <line x1={FX0 - 46} x2={FX0} y1={bottom} y2={bottom} className="ln-thin" pathLength={1} />
          <path d={`M${FX0 - 40},${bottom - 9} h12 l-6,9 Z`} className="level-mark" />
          <text x={FX0 - 52} y={bottom - 3} textAnchor="end">
            {fmtLevel(level(k))}
          </text>
        </g>
        <rect x={FX0} y={top} width={W} height={FLOOR_H} className="floor-hit" />
      </g>
    );
  });

  const court: Target = { id: COURT.id, module: COURT.module, to: COURT.to, where: COURT.name };
  const layer = (z: number) => css({ "--z": z });

  return (
    <div className={`firm firm--${variant}`} data-sky={sky}>
      <svg
        className="firm-svg"
        viewBox={variant === "hero" ? "0 0 1800 1000" : "70 230 1100 700"}
        preserveAspectRatio={variant === "hero" ? "xMidYMax slice" : "xMidYMid meet"}
        {...(interactive
          ? { role: "group", "aria-label": "The firm — each floor opens a part of the practice" }
          : { "aria-hidden": true, focusable: false })}
      >
        <defs>
          <pattern id={`${uid}-hatch`} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={9} className="hatch" />
          </pattern>
          <radialGradient id={`${uid}-halo`}>
            <stop offset="0" className="halo-0" />
            <stop offset="1" className="halo-1" />
          </radialGradient>
          <radialGradient id={`${uid}-spill`}>
            <stop offset="0" className="spill-0" />
            <stop offset="1" className="spill-1" />
          </radialGradient>
          <linearGradient id={`${uid}-haze`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="haze-0" />
            <stop offset="1" className="haze-1" />
          </linearGradient>
        </defs>

        {/* sky */}
        <g className="px" style={layer(-18)}>
          <g className="stars">
            {STARS.map((s, k) => (
              <circle key={k} className="star" cx={s.x} cy={s.y} r={s.r} style={{ animationDelay: `${s.d}ms` }} />
            ))}
          </g>
          <circle cx={1330} cy={150} r={120} style={{ fill: `url(#${uid}-halo)` }} className="halo" />
          <circle cx={1330} cy={150} r={22} className="moon" />
        </g>

        {/* the far city, hazed, and the nearer one */}
        <g className="px far1" style={layer(-14)}>
          {FAR1.map(([x, w, h]) => (
            <rect key={x} x={x} y={GROUND - h} width={w} height={h} />
          ))}
        </g>
        <rect x={-100} y={440} width={2000} height={GROUND - 440} style={{ fill: `url(#${uid}-haze)` }} />
        <g className="px far2" style={layer(-9)}>
          {FAR2.map(([x, w, h]) => (
            <g key={x}>
              <rect x={x} y={GROUND - h} width={w} height={h} />
              {Array.from({ length: Math.floor(h / 30) }, (_, r) =>
                [0, 1, 2].map((c) =>
                  hash(x + r * 7 + c) % 4 === 0 ? (
                    <rect key={`${r}-${c}`} x={x + 9 + c * ((w - 24) / 2)} y={GROUND - h + 12 + r * 30} width={6} height={10} className="far-win" />
                  ) : null
                )
              )}
            </g>
          ))}
        </g>

        {/* the courthouse, a little way off */}
        <g className="px" style={layer(-5)}>
          <g className={`court${active?.id === "court" ? " is-active" : ""}`} style={delay(250)} {...target(court)}>
            <Courthouse />
            <rect x={90} y={530} width={310} height={350} className="floor-hit" />
          </g>
        </g>

        {/* the firm */}
        <g className="firm-building" style={delay(0)}>
          <rect x={FX1} y={ROOF + 18} width={26} height={GROUND - ROOF - 18} className="shade" />
          <rect x={1000} y={306 + 12} width={14} height={42 - 12} className="shade" />
          <rect x={FX0} y={ROOF} width={W} height={GROUND - ROOF} className="facade" />

          {/* penthouse, emblem, flag */}
          <rect x={800} y={306} width={200} height={42} className="facade ln" pathLength={1} />
          <Scales x={900} y={327} s={1.35} />
          <line x1={1100} x2={1100} y1={340} y2={262} className="ln" pathLength={1} />
          <path d="M1100,262 L1126,264 L1126,277 L1100,275 Z" className="flag" />

          {floors}

          {/* the lobby: reception, a bench, a revolving door */}
          <g className="floor lobby" data-floor="lobby" style={delay(LOBBY_AT)}>
            <text x={FX0 + 14} y={LOBBY_TOP + 16} className="core-num lit">
              G
            </text>
            <text x={FX0 + 14} y={LOBBY_TOP + 31} className="core-name lit">
              {LOBBY.name}
            </text>
            <text x={FX0 + 14} y={LOBBY_TOP + 46} className="script lit">
              {LOBBY.script}
            </text>
            <rect x={BAY0 + 3} y={LOBBY_TOP + 3} width={FX1 - BAY0 - 9} height={GROUND - LOBBY_TOP - 3} className="room lit" />
            <g className="ink lit">
              <text x={(BAY0 + FX1) / 2 - 20} y={LOBBY_TOP + 22} textAnchor="middle" className="firm-sign">
                INVENTDB · LEGAL
              </text>
              <rect x={BAY0 + 18} y={GROUND - 22} width={70} height={22} />
              <Figure x={BAY0 + 52} yb={GROUND - 22} tall={0.7} />
              <rect x={BAY0 + 120} y={GROUND - 12} width={56} height={4} />
              <rect x={BAY0 + 122} y={GROUND - 8} width={3} height={8} />
              <rect x={BAY0 + 171} y={GROUND - 8} width={3} height={8} />
              <Figure x={BAY0 + 138} yb={GROUND - 12} tall={0.85} />
              <Figure x={BAY0 + 200} yb={GROUND} tall={1.6} />
              <circle cx={BAY0 + 228} cy={GROUND - 20} r={9} className="ink-line" />
              <rect x={BAY0 + 224} y={GROUND - 11} width={8} height={11} />
              {/* revolving door: canopy, drum, centre post, and two wings
                  that sweep toward and away from the post as it turns */}
              <rect x={1062} y={LOBBY_TOP + 30} width={56} height={5} />
              <rect x={1066} y={LOBBY_TOP + 35} width={48} height={GROUND - LOBBY_TOP - 36} className="ink-line" />
              <line x1={1090} x2={1090} y1={LOBBY_TOP + 35} y2={GROUND} className="ink-line heavy" />
              <g className="revolve" style={pivot(1090, LOBBY_TOP + 60)}>
                <line x1={1070} x2={1070} y1={LOBBY_TOP + 40} y2={GROUND - 4} className="ink-line heavy" />
                <line x1={1110} x2={1110} y1={LOBBY_TOP + 40} y2={GROUND - 4} className="ink-line heavy" />
              </g>
            </g>
            <g className="level">
              <line x1={FX0 - 46} x2={FX0} y1={GROUND} y2={GROUND} className="ln-thin" pathLength={1} />
              <path d={`M${FX0 - 40},${GROUND - 9} h12 l-6,9 Z`} className="level-mark" />
              <text x={FX0 - 52} y={GROUND - 3} textAnchor="end">
                {fmtLevel(0)}
              </text>
            </g>
          </g>

          {/* the cut: slabs, walls and core in solid poché */}
          <g className="poche">
            <rect x={FX0 - 8} y={ROOF - 8} width={W + 16} height={8} />
            {Array.from({ length: 8 }, (_, k) => (
              <rect key={k} x={FX0} y={LOBBY_TOP - k * FLOOR_H - 5} width={W} height={5} />
            ))}
            <rect x={FX0} y={ROOF} width={6} height={GROUND - ROOF} />
            <rect x={FX1 - 6} y={ROOF} width={6} height={LOBBY_TOP - ROOF} />
            <rect x={BAY0 - 3} y={ROOF} width={3} height={GROUND - ROOF} />
          </g>

          {/* the lift: its shaft in the core, and the car going about its day */}
          <line x1={SHAFT} x2={SHAFT} y1={ROOF} y2={GROUND} className="ln-thin" pathLength={1} />
          <line x1={SHAFT + 16} x2={SHAFT + 16} y1={ROOF} y2={GROUND} className="ln-thin" pathLength={1} />
          <line x1={SHAFT + 8} x2={SHAFT + 8} y1={ROOF} y2={GROUND} className="cable" />
          <g className="lift">
            <rect x={SHAFT + 2} y={LEADER_Y - 9} width={12} height={18} className="car" />
          </g>

          <rect x={FX0} y={ROOF} width={W} height={GROUND - ROOF} className="ln" pathLength={1} />
          {Array.from({ length: BAYS - 1 }, (_, b) => (
            <line
              key={b}
              x1={BAY0 + (b + 1) * BAY_W}
              x2={BAY0 + (b + 1) * BAY_W}
              y1={ROOF}
              y2={LOBBY_TOP}
              className="ln-thin"
              pathLength={1}
            />
          ))}

          {/* overall height */}
          <g className="dim">
            <line x1={FX0 - 120} x2={FX0 - 120} y1={GROUND} y2={ROOF} className="ln-thin" pathLength={1} />
            <line x1={FX0 - 128} x2={FX0 - 112} y1={GROUND + 8} y2={GROUND - 8} className="ln-thin" pathLength={1} />
            <line x1={FX0 - 128} x2={FX0 - 112} y1={ROOF + 8} y2={ROOF - 8} className="ln-thin" pathLength={1} />
            <text x={FX0 - 130} y={(GROUND + ROOF) / 2} transform={`rotate(-90 ${FX0 - 130} ${(GROUND + ROOF) / 2})`} textAnchor="middle">
              {`${level(8).toFixed(2)} m · 9 storeys`}
            </text>
          </g>
        </g>

        {/* the leader from the lobby to the sign-in sheet */}
        {variant === "hero" && (
          <g className="leader">
            <circle cx={FX1} cy={LEADER_Y} r={4} />
            <line x1={FX1} x2={1900} y1={LEADER_Y} y2={LEADER_Y} pathLength={1} />
          </g>
        )}

        {/* the street, cut, with the lobby's light spilling onto it */}
        <rect x={-100} y={GROUND} width={2000} height={140} style={{ fill: `url(#${uid}-hatch)` }} className="soil" />
        <ellipse cx={980} cy={GROUND + 4} rx={320} ry={34} style={{ fill: `url(#${uid}-spill)` }} className="spill" />
        <line x1={-100} x2={1900} y1={GROUND} y2={GROUND} className="ground ln" pathLength={1} />
        <g className="px" style={layer(8)}>
          {[470, 1200, 1330, 1490, 1660].map((x) => (
            <Lamp key={x} x={x} />
          ))}
          {[420, 590, 1250, 1420, 1580, 1740].map((x, k) => (
            <Tree key={x} x={x} s={k % 2 ? 0.92 : 1.08} />
          ))}
          <Passerby x={1170} />
          <Passerby x={1184} tall={0.94} />
          <Passerby x={530} tall={0.97} />
        </g>
      </svg>

      {variant === "banner" && (
        <div className="firm-caption" aria-hidden>
          {active ? (
            <>
              <b>{active.where}</b> · {active.module}
            </>
          ) : (
            "Each floor of the firm opens its part of the practice"
          )}
        </div>
      )}
    </div>
  );
}

/** Memoised: the dashboard re-renders on every drag step; the drawing needn't. */
export const FirmScene = memo(FirmSceneImpl);
