/**
 * FirmScene — the law firm, cut open so every floor shows, on the login page
 * and the dashboard banner.
 *
 * The floors are named for what a firm's partners look for in running the
 * practice, not for the software's modules — New Business, Client Care, Case
 * Management, Profitability, Compliance, Risk & Deadlines, Documents and
 * Practice Insight — each with a line of script on what it gives the firm, and
 * a hand-drawn scene of that work in its first bay: the engagement letter
 * signed, briefs tied in ribbon, client money held in balance against the
 * ledger, the limitation date circled. The other rooms are the firm at work —
 * counsel in gown and bands, banker's lamps, law reports, sealed deeds.
 *
 * It is alive in small ways: a lift travels the core, the
 * clock keeps time, the scales settle, the hourglass turns, the safe's dial
 * turns. Nothing pulses or flickers. The courthouse stands a little way off.
 *
 * On login the building draws itself, the lobby and then each floor light up,
 * and a line runs out of the lobby to the sign-in sheet, which arrives last
 * (its timing is in global.css). The layers carry a
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
import { FLOORS as BUILDING } from "../config/floors";

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
const CORE = 172;
const SHAFT = FX0 + CORE - 22;
const BAY0 = FX0 + CORE;
const BAYS = 4;
const BAY_W = (FX1 - BAY0) / BAYS;
const GROUND = 880;
const LOBBY_TOP = 780;
const FLOOR_H = 54;
const ROOF = LOBBY_TOP - 8 * FLOOR_H; // 348
export const LEADER_Y = 825;


/** Stable pseudo-random 0..1008, so nothing reshuffles between renders. */
const hash = (n: number) => (Math.imul(n * 7919 + 13, 0x9e3779b1) >>> 0) % 1009;

const css = (o: Record<string, string | number>) => o as CSSProperties;
const delay = (ms: number) => css({ "--d": `${ms}ms` });
/** A rotation pivot, in user units. */
const pivot = (x: number, y: number) => css({ transformOrigin: `${x}px ${y}px` });

/* ── The scenes, one per floor, drawn into a bay ───────────────────────── */

type Box = { x: number; y: number; w: number; h: number };

/** A figure in everyday clothes: head and shoulders, feet at `yb`. */
function Figure({ x, yb, tall = 1 }: { x: number; yb: number; tall?: number }) {
  const body = 14 * tall;
  return (
    <>
      <circle cx={x} cy={yb - body - 4.5} r={3.6} />
      <path d={`M${x - 4.6},${yb} l0.8,-${body - 4} a3.8,3.8 0 0 1 7.6,0 l0.8,${body - 4} Z`} />
    </>
  );
}

/** An advocate in gown and bands — the firm's own people. */
function Advocate({ x, yb, tall = 1 }: { x: number; yb: number; tall?: number }) {
  const t = tall;
  return (
    <>
      <circle cx={x} cy={yb - 25 * t} r={3.6} />
      <path d={`M${x - 7.5},${yb} L${x - 4.5},${yb - 17 * t} a4.5,4.5 0 0 1 9,0 L${x + 7.5},${yb} Z`} />
      <rect x={x - 1.5} y={yb - 21 * t} width={1.2} height={4.5} className="bands" />
      <rect x={x + 0.3} y={yb - 21 * t} width={1.2} height={4.5} className="bands" />
    </>
  );
}

/** Someone seated: the figure, shortened, sitting at `yb`. */
const Seated = ({ x, yb }: { x: number; yb: number }) => <Figure x={x} yb={yb} tall={0.75} />;

/** The green-shaded banker's lamp of every law office, standing at `yb`. */
function BankersLamp({ x, yb }: { x: number; yb: number }) {
  return (
    <>
      <rect x={x - 3.5} y={yb - 2} width={7} height={2} />
      <line x1={x} x2={x} y1={yb - 2} y2={yb - 8} className="ink-line" />
      <path d={`M${x - 7.5},${yb - 8} h15 l-2.5,-5 h-10 Z`} />
    </>
  );
}

/** A sheet of paper: deed, letter or certificate. */
function Paper({ x, y, w, h, lines = 3 }: Box & { lines?: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} className="paper" />
      {Array.from({ length: lines }, (_, i) => (
        <line key={i} x1={x + 2.5} x2={x + w - 2.5} y1={y + 4 + i * 3.5} y2={y + 4 + i * 3.5} className="paper-line" />
      ))}
    </>
  );
}

/** A wax seal with its ribbon tails. */
function Seal({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path d={`M${x - 2},${y + 2} l-2,6 l2.5,-1.5 l1,2 Z M${x + 2},${y + 2} l2,6 l-2.5,-1.5 l-1,2 Z`} />
      <circle cx={x} cy={y} r={3.2} />
    </>
  );
}

/** Rows of bound law reports: uniform spines, each with a gilt band. */
function LawBooks({ x, y, w, h, rows }: Box & { rows: number }) {
  const rh = h / rows;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} className="ink-line" />
      {Array.from({ length: rows }, (_, r) => {
        const base = y + (r + 1) * rh;
        const n = Math.floor((w - 3) / 4);
        return (
          <g key={r}>
            {Array.from({ length: n }, (_, i) => (
              <rect key={i} x={x + 2 + i * 4} y={base - rh + 2.5} width={3} height={rh - 2.5} />
            ))}
            <line x1={x + 2} x2={x + 2 + n * 4} y1={base - rh + 5} y2={base - rh + 5} className="bands-line" />
            <line x1={x} x2={x + w} y1={base} y2={base} className="ink-line" />
          </g>
        );
      })}
    </>
  );
}

/** New Business — the first consultation, and the engagement letter signed. */
function NewBusiness({ x, y, w, h }: Box) {
  const yb = y + h;
  const cx = x + w / 2;
  return (
    <>
      <rect x={x + 6} y={yb - 13} width={w - 12} height={2.4} />
      <rect x={x + 8} y={yb - 11} width={2} height={11} />
      <rect x={x + w - 10} y={yb - 11} width={2} height={11} />
      <Advocate x={x + 13} yb={yb - 11} tall={0.62} />
      <Seated x={x + w - 13} yb={yb - 11} />
      <line x1={cx} x2={cx} y1={yb - 13} y2={y + 27} className="ink-line" />
      <Paper x={cx - 8} y={y + 4} w={16} h={23} lines={3} />
      <path d={`M${cx - 5},${y + 22} q2,-3 3.5,0 t3.5,0 t3,-1`} className="sign" />
      <line x1={cx + 5} y1={y + 23} x2={cx + 12} y2={y + 15} className="ink-line heavy" />
    </>
  );
}

/** Client Care — a client and their lawyer at ease, the firm's credentials on the wall. */
function ClientCare({ x, y, w, h }: Box) {
  const yb = y + h;
  const cx = x + w / 2;
  return (
    <>
      <Paper x={cx - 10} y={y + 4} w={20} h={13} lines={2} />
      <Seal x={cx + 6} y={y + 14} />
      {/* armchairs, facing */}
      <rect x={x + 4} y={yb - 22} width={3} height={22} />
      <rect x={x + 4} y={yb - 9} width={15} height={3} />
      <rect x={x + 16} y={yb - 6} width={2} height={6} />
      <Seated x={x + 12} yb={yb - 9} />
      <rect x={x + w - 7} y={yb - 22} width={3} height={22} />
      <rect x={x + w - 19} y={yb - 9} width={15} height={3} />
      <rect x={x + w - 18} y={yb - 6} width={2} height={6} />
      <Seated x={x + w - 12} yb={yb - 9} />
      {/* the client's file, on the table between them */}
      <rect x={cx - 6} y={yb - 12} width={12} height={2} />
      <rect x={cx - 1} y={yb - 10} width={2} height={10} />
      <rect x={cx - 5} y={yb - 16} width={10} height={4} className="paper" />
    </>
  );
}

/** Case Management — briefs tied in ribbon, and counsel taking one up. */
function CaseManagement({ x, y, w, h }: Box) {
  const yb = y + h;
  return (
    <>
      <rect x={x + 4} y={yb - 13} width={42} height={2.4} />
      <rect x={x + 6} y={yb - 11} width={2} height={11} />
      <rect x={x + 42} y={yb - 11} width={2} height={11} />
      {[
        [x + 7, yb - 19, 17],
        [x + 9, yb - 25, 14],
        [x + 11, yb - 31, 12],
      ].map(([bx, by, bw]) => (
        <g key={by}>
          <rect x={bx} y={by} width={bw} height={6} className="paper" />
          <line x1={bx + bw / 2} x2={bx + bw / 2} y1={by} y2={by + 6} className="ribbon" />
        </g>
      ))}
      <path d={`M${x + 17},${y + 12} l-3,-3 m3,3 l3,-3`} className="ribbon" />
      <BankersLamp x={x + 35} yb={yb - 13} />
      <Advocate x={x + w - 11} yb={yb} tall={1.05} />
      <rect x={x + w - 23} y={yb - 21} width={7} height={9} className="paper" />
      <line x1={x + w - 19.5} x2={x + w - 19.5} y1={yb - 21} y2={yb - 12} className="ribbon" />
    </>
  );
}

/** Profitability — the clock that time is recorded against, in six-minute
 *  units, and the ledger it ends up in. */
function Profitability({ x, y, w, h }: Box) {
  const yb = y + h;
  const cx = x + 20;
  const cy = y + 19;
  const wedge = (36 * Math.PI) / 180;
  return (
    <>
      <path d={`M${cx},${cy} L${cx},${cy - 13} A13,13 0 0 1 ${cx + Math.sin(wedge) * 13},${cy - Math.cos(wedge) * 13} Z`} className="unit" />
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
      {/* the ledger, open on a desk, with the day's fees beside it */}
      <rect x={x + 38} y={yb - 11} width={w - 42} height={2.4} />
      <rect x={x + 40} y={yb - 9} width={2} height={9} />
      <rect x={x + w - 6} y={yb - 9} width={2} height={9} />
      <rect x={x + 39} y={yb - 27} width={22} height={15} className="paper" />
      <line x1={x + 50} x2={x + 50} y1={yb - 27} y2={yb - 12} className="paper-line" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <line x1={x + 41} x2={x + 48} y1={yb - 23 + i * 4} y2={yb - 23 + i * 4} className="paper-line" />
          <line x1={x + 52} x2={x + 59} y1={yb - 23 + i * 4} y2={yb - 23 + i * 4} className="paper-line" />
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={x + w - 10} y={yb - 13.5 - i * 2.4} width={7} height={1.8} rx={0.9} />
      ))}
    </>
  );
}

/** Compliance — client money and the ledger, held in balance; the safe beside. */
function Compliance({ x, y, w, h }: Box) {
  const yb = y + h;
  const sx = x + 22;
  const by = y + 11;
  return (
    <>
      <rect x={sx - 7} y={yb - 3} width={14} height={3} />
      <line x1={sx} x2={sx} y1={yb - 3} y2={by} className="ink-line heavy" />
      <circle cx={sx} cy={by - 2} r={1.8} />
      <g className="tip" style={pivot(sx, by)}>
        <line x1={sx - 16} x2={sx + 16} y1={by} y2={by} className="ink-line heavy" />
        {[-16, 16].map((d) => (
          <g key={d}>
            <line x1={sx + d} x2={sx + d - 5} y1={by} y2={by + 13} className="ink-line" />
            <line x1={sx + d} x2={sx + d + 5} y1={by} y2={by + 13} className="ink-line" />
            <path d={`M${sx + d - 7},${by + 13} q7,6 14,0 Z`} />
          </g>
        ))}
        {/* coins on one pan, the trust ledger on the other */}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={sx - 20} y={by + 10 - i * 2.4} width={8} height={1.9} rx={0.9} />
        ))}
        <rect x={sx + 12} y={by + 5} width={8} height={7} className="paper" />
      </g>
      <rect x={x + w - 22} y={yb - 25} width={19} height={25} className="ink-line heavy" />
      <circle cx={x + w - 12.5} cy={yb - 14} r={5} className="ink-line" />
      <g className="dial" style={pivot(x + w - 12.5, yb - 14)}>
        <line x1={x + w - 12.5} x2={x + w - 12.5} y1={yb - 14} y2={yb - 18} className="ink-line heavy" />
      </g>
      <rect x={x + w - 8} y={yb - 5} width={3} height={2} />
    </>
  );
}

/** Risk & Deadlines — the date that cannot be missed, and the sand running. */
function RiskDeadlines({ x, y, w, h }: Box) {
  const yb = y + h;
  const gx = x + 5;
  const gy = y + 6;
  const hx = x + w - 14;
  const hy = y + 22;
  return (
    <>
      <rect x={gx} y={gy} width={36} height={30} className="paper" />
      <rect x={gx} y={gy} width={36} height={6} />
      {[1, 2, 3].map((c) => (
        <line key={c} x1={gx + c * 9} x2={gx + c * 9} y1={gy + 6} y2={gy + 30} className="paper-line" />
      ))}
      {[1, 2].map((r) => (
        <line key={r} x1={gx} x2={gx + 36} y1={gy + 6 + r * 8} y2={gy + 6 + r * 8} className="paper-line" />
      ))}
      <ellipse cx={gx + 22.5} cy={gy + 18} rx={6} ry={5} className="ink-line heavy" />
      <rect x={hx - 9} y={yb - 3} width={18} height={3} />
      <g className="flip" style={pivot(hx, hy)}>
        <rect x={hx - 8} y={hy - 16} width={16} height={2.5} />
        <rect x={hx - 8} y={hy + 13.5} width={16} height={2.5} />
        <path d={`M${hx - 6},${hy - 13.5} h12 l-6,13.5 l6,13.5 h-12 l6,-13.5 Z`} className="ink-line" />
        <path d={`M${hx - 4.5},${hy + 13.5} h9 l-4.5,-6 Z`} />
        <path d={`M${hx - 3},${hy - 10} h6 l-3,4 Z`} />
      </g>
      <line x1={hx} x2={hx} y1={hy + 16} y2={yb - 3} className="ink-line" />
    </>
  );
}

/** Documents — the firm's library of law reports, and a sealed deed on the lectern. */
function Documents({ x, y, w, h }: Box) {
  const yb = y + h;
  const lx = x + w - 15;
  return (
    <>
      <LawBooks x={x + 4} y={y + 4} w={37} h={h - 4} rows={4} />
      <line x1={lx} x2={lx} y1={yb} y2={y + 30} className="ink-line heavy" />
      <rect x={lx - 6} y={yb - 2} width={12} height={2} />
      <path d={`M${lx - 9},${y + 30} l18,-4 v2 l-18,4 Z`} />
      <rect x={lx - 8} y={y + 6} width={16} height={21} className="paper" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={lx - 5.5} x2={lx + 5.5} y1={y + 10 + i * 3.5} y2={y + 10 + i * 3.5} className="paper-line" />
      ))}
      <Seal x={lx + 3} y={y + 22} />
    </>
  );
}

/** Practice Insight — the partners' meeting, the firm's year on the board. */
function PracticeInsight({ x, y, w, h }: Box) {
  const yb = y + h;
  const ex = x + 17;
  return (
    <>
      <line x1={ex} y1={y + 26} x2={ex - 9} y2={yb} className="ink-line heavy" />
      <line x1={ex} y1={y + 26} x2={ex + 9} y2={yb} className="ink-line heavy" />
      <rect x={ex - 13} y={y + 4} width={26} height={22} className="paper" />
      {[
        [4, 6],
        [10, 10],
        [16, 15],
      ].map(([dx, bh]) => (
        <rect key={dx} x={ex - 13 + dx} y={y + 23 - bh} width={4.5} height={bh} />
      ))}
      <line x1={ex - 10} x2={ex + 10} y1={y + 23} y2={y + 23} className="paper-line" />
      <Advocate x={x + 39} yb={yb} tall={1.05} />
      <line x1={x + 35} y1={yb - 19} x2={ex + 11} y2={y + 14} className="ink-line heavy" />
      <rect x={x + 48} y={yb - 12} width={w - 50} height={2.4} />
      <rect x={x + w - 5} y={yb - 10} width={2} height={10} />
      <Seated x={x + w - 11} yb={yb - 12} />
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
// Names and scripts come from the building the signed-in app files its
// sections under (config/floors), so the firm drawn on the way in and the
// floors you then work on can never disagree.
const story = (num: string) => {
  const f = BUILDING.find((b) => b.num === num);
  return { name: f?.name ?? "", script: f?.script ?? "" };
};

const FLOORS: Floor[] = [
  { id: "intake", ...story("01"), ...entity("intake_and_leads"), Scene: NewBusiness },
  { id: "clients", ...story("02"), ...entity("clients"), Scene: ClientCare },
  { id: "matters", ...story("03"), ...entity("matters"), Scene: CaseManagement },
  { id: "billing", ...story("04"), module: "Time & Billing", to: "/time_entries", Scene: Profitability },
  { id: "trust", ...story("05"), ...entity("trust_ledger_cta"), Scene: Compliance },
  { id: "docket", ...story("06"), ...entity("deadlines_and_sol"), Scene: RiskDeadlines },
  { id: "records", ...story("07"), module: "Files", to: "/files", Scene: Documents },
  { id: "reports", ...story("08"), module: "Reports", to: "/reports", Scene: PracticeInsight },
];

const LOBBY = story("G");
const COURT = { id: "court", name: "The Court", script: "hearings, on the calendar", ...entity("court_calendar") };

/** The building, floor by floor, for a screen-reader list on login. */
export const FIRM_FEATURES = [
  `${LOBBY.name} — ${LOBBY.script}`,
  ...FLOORS.map((f) => `${f.name} — ${f.script} (${f.module})`),
  `${COURT.name} — ${COURT.script} (${COURT.module})`,
];

/** The drafting sequence, in ms: lines, then lights from the lobby up. */
const LOBBY_AT = 900;
const floorAt = (k: number) => 1050 + k * 130;

/* ── The firm's other rooms ─────────────────────────────────────────────── */

/**
 * The bays beside each floor's scene are the firm at work: a lawyer at a desk
 * under a banker's lamp, counsel at the law reports, a conference across the
 * table, the files, a framed admission on the wall. `v` picks which, stepping
 * across the floors rather than at random, so no two neighbouring bays repeat
 * and each floor has about one room dark.
 */
function Bay({ x, y, w, h, v }: Box & { v: number }) {
  const yb = y + h;
  if (v === 5) return <rect x={x} y={y} width={w} height={h} className="room off ln-thin" pathLength={1} />;
  return (
    <g className="bay">
      <rect x={x} y={y} width={w} height={h} className="room lit" />
      <g className="ink lit">
        {v === 0 && (
          <>
            <rect x={x + 6} y={yb - 13} width={w - 12} height={2.4} />
            <rect x={x + 8} y={yb - 11} width={2} height={11} />
            <rect x={x + w - 10} y={yb - 11} width={2} height={11} />
            <Seated x={x + w * 0.3} yb={yb - 11} />
            <rect x={x + w * 0.42} y={yb - 15} width={9} height={2} className="paper" />
            <BankersLamp x={x + w * 0.72} yb={yb - 13} />
          </>
        )}
        {v === 1 && (
          <>
            <LawBooks x={x + 5} y={y + 6} w={29} h={h - 6} rows={3} />
            <Advocate x={x + w * 0.72} yb={yb} tall={1.05} />
            <rect x={x + w * 0.72 - 12} y={yb - 22} width={6} height={8} className="paper" />
          </>
        )}
        {v === 2 && (
          <>
            <rect x={x + w * 0.2} y={yb - 12} width={w * 0.6} height={2.4} />
            <rect x={x + w * 0.5 - 1} y={yb - 10} width={2} height={10} />
            <Seated x={x + w * 0.18} yb={yb - 10} />
            <Seated x={x + w * 0.82} yb={yb - 10} />
            <rect x={x + w * 0.36} y={yb - 15} width={8} height={3} className="paper" />
            <rect x={x + w * 0.52} y={yb - 15} width={8} height={3} className="paper" />
          </>
        )}
        {v === 3 && (
          <>
            <rect x={x + 7} y={yb - 30} width={17} height={30} className="ink-line heavy" />
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <line x1={x + 7} x2={x + 24} y1={yb - 20 + i * 10} y2={yb - 20 + i * 10} className="ink-line" />
                <rect x={x + 13} y={yb - 26 + i * 10} width={5} height={1.8} />
              </g>
            ))}
            <Figure x={x + w * 0.66} yb={yb} tall={1.15} />
            <rect x={x + w * 0.66 - 11} y={yb - 21} width={7} height={9} className="paper" />
          </>
        )}
        {v === 4 && (
          <>
            <Paper x={x + w / 2 - 9} y={y + 5} w={18} h={12} lines={2} />
            <Seal x={x + w / 2 + 5} y={y + 15} />
            <rect x={x + 8} y={yb - 13} width={w - 16} height={2.4} />
            <rect x={x + 10} y={yb - 11} width={2} height={11} />
            <rect x={x + w - 12} y={yb - 11} width={2} height={11} />
            <Advocate x={x + w * 0.36} yb={yb - 11} tall={0.62} />
            <rect x={x + w * 0.55} y={yb - 21} width={12} height={8} className="paper" />
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
function Scales({ x, y, s = 1, ink = false }: { x: number; y: number; s?: number; ink?: boolean }) {
  return (
    <g className={ink ? "emblem ink-emblem" : "emblem"} transform={`translate(${x} ${y}) scale(${s})`}>
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
          {String(k + 1).padStart(2, "0")}
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
              v={(k * 5 + b * 2) % 6}
            />
          );
        })}
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
              {/* the firm's scales on the wall behind the reception desk */}
              <Scales x={BAY0 + 32} y={LOBBY_TOP + 46} s={1.1} ink />
              <rect x={BAY0 + 18} y={GROUND - 22} width={70} height={22} />
              <Figure x={BAY0 + 60} yb={GROUND - 22} tall={0.7} />
              {/* a client waiting, briefcase at their side */}
              <rect x={BAY0 + 120} y={GROUND - 12} width={56} height={4} />
              <rect x={BAY0 + 122} y={GROUND - 8} width={3} height={8} />
              <rect x={BAY0 + 171} y={GROUND - 8} width={3} height={8} />
              <Figure x={BAY0 + 138} yb={GROUND - 12} tall={0.85} />
              <rect x={BAY0 + 150} y={GROUND - 19} width={12} height={7} rx={1} />
              <path d={`M${BAY0 + 153},${GROUND - 19} v-2.5 h6 v2.5`} className="ink-line" />
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

        </g>

        {/* the leader from the lobby to the sign-in sheet */}
        {variant === "hero" && (
          <g className="leader">
            <circle cx={FX1} cy={LEADER_Y} r={4} />
            <line x1={FX1} x2={1900} y1={LEADER_Y} y2={LEADER_Y} pathLength={1} />
          </g>
        )}

        {/* the street, with the lobby's light spilling onto it */}
        <rect x={-100} y={GROUND} width={2000} height={140} className="street" />
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
