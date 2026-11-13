/**
 * The six plates in the sign-in booklet, one for each part of the practice,
 * drawn in line: an engagement letter being signed, a case file, a calendar
 * with the due date circled, a notice stamped FILED, a stopwatch on 2.4 hours,
 * and the trust ledger balanced.
 *
 * Oxblood line, with brass for the one thing that matters on each. A plate
 * draws itself in when its page comes into view (`on`) and otherwise rests
 * finished. Styles are in styles/desk.css.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Every stroke is measured as 1, so one dash animation draws any shape. */
const L = { pathLength: 1 } as const;

const PLATES: { label: string; art: ReactNode }[] = [
  {
    label: "A signed engagement letter and a pen",
    art: (
      <>
        <path {...L} className="f" d="M62 30 L170 22 L178 148 L70 156 Z" />
        <text x="84" y="46" className="big" transform="rotate(-4 84 46)">
          Engagement Letter
        </text>
        <path {...L} d="M84 62 L156 57" />
        <path {...L} d="M85 74 L162 68" />
        <path {...L} d="M86 86 L146 82" />
        <path {...L} d="M87 98 L158 92" />
        <path {...L} className="b" d="M90 130 c6 -16 12 -16 14 0 s9 16 14 0 s9 -16 14 0 s8 12 13 3" />
        <path {...L} d="M88 140 L160 134" />
        <path {...L} className="b" d="M148 128 L204 88" />
        <path {...L} className="b" d="M204 88 L214 81" />
      </>
    ),
  },
  {
    label: "An open case file",
    art: (
      <>
        <path {...L} d="M64 70 V40 h104 v30" />
        <path {...L} d="M78 52 h70" />
        <path
          {...L}
          d="M50 52 h44 l10 12 h86 a6 6 0 0 1 6 6 v76 a6 6 0 0 1 -6 6 H50 a6 6 0 0 1 -6 -6 V58 a6 6 0 0 1 6 -6 z"
        />
        <path {...L} className="f" d="M40 86 h160 l-8 66 H48 z" />
        <rect {...L} className="fb" x="90" y="106" width="60" height="22" rx="4" />
        <text x="120" y="121" textAnchor="middle">
          MT-2987
        </text>
      </>
    ),
  },
  {
    label: "A calendar with the 16th circled",
    art: (
      <>
        <rect {...L} className="f" x="54" y="34" width="132" height="120" rx="12" />
        <path {...L} d="M54 62 h132" />
        <path {...L} d="M86 26 v16" />
        <path {...L} d="M154 26 v16" />
        <text x="120" y="54" textAnchor="middle">
          NOVEMBER
        </text>
        {Array.from({ length: 20 }, (_, n) => {
          if (n === 13) return null;
          const cx = 76 + (n % 5) * 22;
          const cy = 82 + Math.floor(n / 5) * 20;
          return <path key={n} {...L} d={`M${cx - 4} ${cy} h8`} />;
        })}
        <circle {...L} className="b" cx="142" cy="122" r="13" />
        <text x="142" y="126" textAnchor="middle" className="big">
          16
        </text>
      </>
    ),
  },
  {
    label: "A notice stamped FILED",
    art: (
      <>
        <rect {...L} className="f" x="64" y="22" width="112" height="140" rx="8" />
        <path {...L} d="M80 42 h80" />
        <path {...L} d="M80 54 h64" />
        <path {...L} d="M80 140 h80" />
        <path {...L} d="M80 150 h52" />
        <g transform="rotate(-11 120 98)">
          <rect {...L} className="stamp" x="74" y="78" width="92" height="40" rx="6" />
          <text x="120" y="105" textAnchor="middle" className="big stamped">
            FILED
          </text>
        </g>
      </>
    ),
  },
  {
    label: "A stopwatch showing 2.4 hours",
    art: (
      <>
        <circle {...L} className="f" cx="120" cy="100" r="54" />
        <path {...L} d="M120 46 V34" />
        <path {...L} d="M106 30 h28" />
        <path {...L} d="M160 60 l9 -9" />
        <path {...L} d="M120 54 v8 M166 100 h-8 M120 146 v-8 M74 100 h8" />
        <path {...L} className="b" d="M120 100 L148 76" />
        <circle {...L} cx="120" cy="100" r="4" />
        <text x="120" y="128" textAnchor="middle" className="big">
          2.4 h
        </text>
      </>
    ),
  },
  {
    label: "An open ledger, balanced",
    art: (
      <>
        <path {...L} className="f" d="M30 44 q45 -14 90 6 q45 -20 90 -6 v104 q-45 -14 -90 6 q-45 -20 -90 -6 z" />
        <path {...L} d="M120 50 v104" />
        <path {...L} d="M46 70 h58 M46 86 h58 M46 102 h58 M46 118 h42" />
        <path {...L} d="M136 68 h58 M136 84 h58 M136 100 h58" />
        <path {...L} className="b" d="M156 116 h38" />
        <path {...L} className="b" d="M156 121 h38" />
        <path {...L} className="b" d="M138 132 l7 7 l13 -14" />
      </>
    ),
  },
];

export function DeskArt({ idea, on }: { idea: number; on: boolean }) {
  const plate = PLATES[idea];
  // Draw in each time the page comes into view; rest finished otherwise.
  const [drawing, setDrawing] = useState(false);
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current) {
      setDrawing(false);
      const t = window.setTimeout(() => setDrawing(true), 380);
      was.current = on;
      return () => window.clearTimeout(t);
    }
    was.current = on;
  }, [on]);
  if (!plate) return null;
  return (
    <svg
      className={`dk-art${drawing ? " is-drawing" : ""}`}
      viewBox="0 0 240 180"
      role="img"
      aria-label={plate.label}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget.lastElementChild) setDrawing(false);
      }}
    >
      {plate.art}
    </svg>
  );
}
