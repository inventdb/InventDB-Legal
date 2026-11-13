/**
 * The booklet on the desk: a short guide to the firm, bound in oxblood, that
 * opens on its own and turns its pages one at a time.
 *
 * On a desktop it is a two-page spread. The cover opens onto the contents and
 * a foreword; each of the six chapters is a spread — the illustration on the
 * left, what the app does there on the right — and the last spread is sign in
 * on the left and sign up on the right. On a phone it is one page at a time:
 * the cover, the foreword, one page per chapter, then sign in and sign up.
 *
 * The tour plays once. Someone who has seen it gets the booklet riffled
 * straight to sign in; reduced-motion settings open it there. Pages turn by
 * the arrows, a click on a page, a swipe, the arrow keys, or the contents, and
 * "Skip to sign in" is always there. Nothing is ever cut off: the booklet
 * measures its tallest page and grows to fit it.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { DeskArt } from "./DeskArt";

interface Chapter {
  group: string;
  sections: string;
  title: string;
  lead: string;
  points: string[];
  plate: string;
}

export const CHAPTERS: Chapter[] = [
  {
    group: "New Business",
    sections: "Intake & Leads",
    title: "An enquiry becomes a client",
    lead: "Every call and web enquiry is captured, dated and screened before anyone gives advice.",
    points: [
      "Leads recorded with where they came from and what they are about",
      "A conflict check against everyone the firm has acted for or against",
      "The limitation date worked out the day the enquiry arrives",
    ],
    plate: "The engagement letter, signed",
  },
  {
    group: "Case Management",
    sections: "Matters · Timekeepers",
    title: "One file for every matter",
    lead: "Each matter is kept as a single file that every other part of the firm reads from.",
    points: [
      "Court, judge, department and case number",
      "The client, the opposing party and the team on it",
      "Fee terms, and the stage from intake to resolution",
    ],
    plate: "The case file, opened",
  },
  {
    group: "Risk & Deadlines",
    sections: "Court Calendar · Deadlines & SOL",
    title: "No deadline missed",
    lead: "Court dates are calendared and every deadline is counted from the rule that sets it.",
    points: [
      "Deadlines computed from the triggering event and the rule",
      "Hearings, depositions and mediations on one calendar",
      "Statutes of limitation watched from the first day",
    ],
    plate: "The due date, circled",
  },
  {
    group: "Documents",
    sections: "Files · Import",
    title: "Every paper in its place",
    lead: "Letters, pleadings and records are filed against their matter and found again by a word in them.",
    points: [
      "Files kept by matter and by folder",
      "Search that reads the text inside the papers",
      "Spreadsheets brought in, column by column",
    ],
    plate: "The notice, stamped FILED",
  },
  {
    group: "Profitability",
    sections: "Time Entries · Costs · Invoices",
    title: "Every hour accounted for",
    lead: "Time is recorded as it is worked and becomes an invoice the client can follow line by line.",
    points: [
      "Time and costs recorded against the matter",
      "Invoices issued, paid and chased",
      "What is owed, and how late, at a glance",
    ],
    plate: "2.4 hours, recorded",
  },
  {
    group: "Compliance",
    sections: "Trust Ledger (CTA) · Payments · Settlements",
    title: "Client money, by the book",
    lead: "Money held for clients is kept apart in trust, every movement entered and reconciled.",
    points: [
      "A running balance for every client and matter",
      "Payments, receipts and settlement disbursements",
      "Three-way reconciliation, month by month",
    ],
    plate: "The trust ledger, balanced",
  },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
/** Positions: 0 closed · 1 foreword · 2–7 the chapters · 8 sign in. */
const LAST = 8;
const TURN_MS = 900;
const RIFFLE_MS = 170;
const SEEN_KEY = "legal.desk.seen";

const seen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* a private window: the tour simply plays again next time */
  }
};

const COUNSEL = (
  <svg viewBox="0 0 128 128" aria-hidden>
    <circle cx="64" cy="28" r="13.5" fill="currentColor" />
    <path
      d="M55 41 C57 60 60 86 64 117 C68 86 71 60 73 41 Z"
      fill="currentColor"
    />
    <path
      d="M64 46 C50 44 34 40 22 34 L22 41.5 C36 48.5 52 54 64 57 Z"
      fill="currentColor"
    />
    <path
      d="M64 46 C78 44 94 40 106 34 L106 41.5 C92 48.5 76 54 64 57 Z"
      fill="currentColor"
    />
    <path
      d="M22 35 L8 67 L36 67 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="5.5"
      strokeLinejoin="round"
    />
    <path d="M8 67 A14 14 0 0 0 36 67 Z" fill="currentColor" />
    <path
      d="M106 35 L92 67 L120 67 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="5.5"
      strokeLinejoin="round"
    />
    <path d="M92 67 A14 14 0 0 0 120 67 Z" fill="currentColor" />
  </svg>
);

/** A face that is not on view is taken out of reach: no tabbing into it, no reading it. */
function Face({
  side,
  kind = "paper",
  shown,
  at,
  onClick,
  children,
}: {
  side: "front" | "back";
  kind?: "paper" | "cover" | "endpaper";
  shown: boolean;
  /** On a phone, the position at which this page is the one in front. */
  at?: number;
  onClick?: (e: ReactMouseEvent) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shown) {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    } else {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    }
  }, [shown]);
  return (
    <div
      ref={ref}
      className={`dk-face ${side} ${kind}${onClick ? " clickable" : ""}`}
      data-at={at}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** Clicks on a page turn it, unless they land on something the page itself does. */
const onControl = (e: ReactMouseEvent) =>
  !!(e.target as HTMLElement).closest(
    "a, button, input, label, form, select, textarea",
  );

export function DeskBook({
  narrow,
  signIn,
  signUp,
  hold = false,
  skipToSignIn = false,
}: {
  narrow: boolean;
  signIn: ReactNode;
  signUp: ReactNode;
  /** While the first-visit walk-in plays, the booklet waits, closed and out of reach. */
  hold?: boolean;
  /** The walk-in was skipped: go straight to sign in. */
  skipToSignIn?: boolean;
}) {
  const reduce = useRef(
    typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  ).current;
  const returning = useRef(seen()).current;

  const [flipped, setFlipped] = useState(reduce ? LAST : 0);
  const pos = useRef(reduce ? LAST : 0);
  const [turning, setTurning] = useState<number[]>([]);
  const [auto, setAuto] = useState(!reduce && !returning);
  const [held, setHeld] = useState(false);
  const stepTimer = useRef<number>();

  const turn = (leaf: number) => {
    setTurning((t) => [...t, leaf]);
    window.setTimeout(
      () => setTurning((t) => t.filter((x) => x !== leaf)),
      TURN_MS + 80,
    );
  };

  /** Turn the pages one at a time until the booklet is open at `target`. */
  const goTo = useCallback((target: number, gap = RIFFLE_MS) => {
    window.clearTimeout(stepTimer.current);
    const step = () => {
      const p = pos.current;
      if (p === target) return;
      const next = p < target ? p + 1 : p - 1;
      turn(p < target ? p : p - 1);
      pos.current = next;
      setFlipped(next);
      if (next !== target) stepTimer.current = window.setTimeout(step, gap);
    };
    step();
  }, []);
  useEffect(() => () => window.clearTimeout(stepTimer.current), []);

  useEffect(() => {
    if (!skipToSignIn) return;
    setAuto(false);
    goTo(LAST, 90);
  }, [skipToSignIn, goTo]);

  // Someone who has read it before is taken straight to sign in, once the
  // opening has handed the booklet over.
  useEffect(() => {
    if (reduce || !returning || hold) return;
    const t = window.setTimeout(() => goTo(LAST, 150), 650);
    return () => window.clearTimeout(t);
  }, [reduce, returning, hold, goTo]);

  // The tour: the cover opens, then each spread is given time to be read.
  useEffect(() => {
    if (flipped >= LAST) {
      markSeen();
      setAuto(false);
      return;
    }
    if (!auto || held || hold) return;
    const wait = flipped === 0 ? 1100 : flipped === 1 ? 4200 : 6500;
    const t = window.setTimeout(() => goTo(flipped + 1), wait);
    return () => window.clearTimeout(t);
  }, [auto, held, hold, flipped, goTo]);

  const next = useCallback(() => {
    setAuto(false);
    if (pos.current < LAST) goTo(pos.current + 1);
  }, [goTo]);
  const prev = useCallback(() => {
    setAuto(false);
    if (pos.current > 0) goTo(pos.current - 1);
  }, [goTo]);
  const jump = (target: number) => {
    setAuto(false);
    goTo(target, 120);
  };
  /** From sign in, back to the contents, and the tour plays again. */
  const retour = () => {
    goTo(1, 120);
    setAuto(true);
  };

  // While held, nothing in the booklet can be reached.
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (hold) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [hold]);

  // The arrow keys turn the pages, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable='true']"))
        return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // A swipe turns a page on a touch screen.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse")
      touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0) next();
    else prev();
  };

  // Nothing is ever cut off. A spread is as tall as its tallest page needs; on
  // a phone, the booklet takes the height of the page in front of you.
  const book = useRef<HTMLDivElement>(null);
  const [need, setNeed] = useState(0);
  const where = useRef({ narrow, flipped });
  where.current = { narrow, flipped };
  const measure = useCallback(() => {
    const el = book.current;
    if (!el) return;
    const natural = (page: HTMLElement) => {
      const was = page.style.height;
      page.style.height = "auto";
      const h = page.offsetHeight;
      page.style.height = was;
      return h;
    };
    let most = 0;
    if (where.current.narrow) {
      const front = el.querySelector<HTMLElement>(
        `.dk-face[data-at="${where.current.flipped}"] .dk-page`,
      );
      if (front) most = natural(front);
    } else {
      el.querySelectorAll<HTMLElement>(".dk-page").forEach((page) => {
        most = Math.max(most, natural(page));
      });
    }
    setNeed((n) => (Math.abs(n - most) > 1 ? most : n));
  }, []);
  useLayoutEffect(() => {
    measure();
  }, [measure, narrow, flipped, signIn]);
  useEffect(() => {
    const el = book.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el.parentElement ?? el);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure]);

  const idea = flipped >= 2 && flipped <= 7 ? flipped - 2 : -1;
  const folio = (n: number | string, hint = true) => (
    <div className="dk-folio">
      <span>InventDB Legal</span>
      {hint && <span className="dk-turn-hint">Turn the page →</span>}
      <span>{n}</span>
    </div>
  );

  /* ---- The pages ---- */
  const cover = (
    <div className="dk-page">
      <div className="dk-cover">
        {COUNSEL}
        <div className="nm">
          InventDB <em>Legal</em>
        </div>
        <div className="sub">Legal practice, modernised.</div>
        <div className="foot">A guide to the firm</div>
      </div>
    </div>
  );
  // The booklet's title page carries the headline, with the contents below it.
  const bookTitle = (
    <p className="dk-book-title">
      Legal practice, <em>modernised.</em>
    </p>
  );
  const contentsList = (
    <ul className="dk-contents">
      <li>
        <button type="button" onClick={() => jump(1)}>
          <span className="n">—</span>
          <span>Foreword</span>
          <span className="p">i</span>
        </button>
      </li>
      {CHAPTERS.map((c, i) => (
        <li key={c.group}>
          <button type="button" onClick={() => jump(i + 2)}>
            <span className="n">{ROMAN[i]}</span>
            <span>{c.group}</span>
            <span className="p">{2 + i * 2}</span>
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={() => jump(LAST)}>
          <span className="n">—</span>
          <span>Signing in and signing up</span>
          <span className="p">14</span>
        </button>
      </li>
    </ul>
  );
  const contents = (
    <div className="dk-page">
      {bookTitle}
      <div className="dk-k">Contents</div>
      {contentsList}
    </div>
  );
  // On a phone there is no left-hand page: the title, the foreword and the
  // contents share the first page after the cover.
  const opening = (
    <div className="dk-page">
      {bookTitle}
      <p className="dk-lead">
        InventDB Legal keeps a firm's matters, deadlines, papers, time and
        client money in one place, on the InventDB SOAR database. The pages that
        follow show how a matter moves through the firm.
      </p>
      <div className="dk-k">Contents</div>
      {contentsList}
      {folio("i")}
    </div>
  );
  const foreword = (
    <div className="dk-page">
      <div className="dk-chapter">Foreword</div>
      <h3>Every part of the practice, under one roof</h3>
      <p className="dk-lead">
        InventDB Legal keeps a firm's matters, deadlines, papers, time and
        client money in one place, on the InventDB SOAR database. The pages that
        follow show how a matter moves through the firm.
      </p>
      <div className="dk-actions">
        <button type="button" className="dk-btn" onClick={next}>
          Turn the page <ChevronRight size={15} aria-hidden />
        </button>
        <button
          type="button"
          className="dk-btn solid"
          onClick={() => jump(LAST)}
        >
          Go to sign in
        </button>
      </div>
      {folio("i", false)}
    </div>
  );
  const plate = (i: number) => (
    <div className="dk-page">
      <div className="dk-plate">
        <DeskArt idea={i} on={idea === i} />
      </div>
      <div className="dk-plate-cap">
        <b>Plate {ROMAN[i]}</b>
        {CHAPTERS[i].plate}
      </div>
      {folio(1 + i * 2, false)}
    </div>
  );
  const text = (i: number, withPlate = false) => {
    const c = CHAPTERS[i];
    return (
      <div className="dk-page">
        {withPlate && (
          <div className="dk-plate">
            <DeskArt idea={i} on={idea === i} />
          </div>
        )}
        <div className="dk-chapter">
          Chapter {ROMAN[i]} · {c.group}
        </div>
        <h3>{c.title}</h3>
        <p className="dk-lead">{c.lead}</p>
        <ul className="dk-points">
          {c.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <div className="dk-where">
          <span>In the app</span>
          {c.sections.split(" · ").map((name) => (
            <b key={name}>{name}</b>
          ))}
        </div>
        {folio(2 + i * 2)}
      </div>
    );
  };
  const finalPages = narrow ? (
    <div className="dk-page">
      {signIn}
      <div className="dk-split" />
      {signUp}
    </div>
  ) : (
    <div className="dk-page">{signUp}</div>
  );

  /* ---- The leaves: a page on each side on a desktop, one page on a phone ---- */
  const leaves: {
    front: ReactNode;
    back?: ReactNode;
    frontKind?: "cover";
    backKind?: "endpaper";
  }[] = narrow
    ? [
        { front: cover, frontKind: "cover" },
        { front: opening },
        ...CHAPTERS.map((_, i) => ({ front: text(i, true) })),
      ]
    : [
        {
          front: cover,
          frontKind: "cover",
          back: contents,
          backKind: "endpaper",
        },
        { front: foreword, back: plate(0) },
        ...CHAPTERS.map((_, i) => ({
          front: text(i),
          back: i < 5 ? plate(i + 1) : <div className="dk-page">{signIn}</div>,
        })),
      ];

  const label =
    flipped === 0
      ? "The cover"
      : flipped === 1
        ? "Foreword"
        : flipped >= LAST
          ? "Sign in"
          : `${CHAPTERS[flipped - 2].group}`;

  return (
    <div className="dk-shell" ref={root}>
      <div className="dk-stage">
        <div
          ref={book}
          className={`dk-book${flipped === 0 ? " is-closed" : ""}`}
          style={{ height: `max(var(--dk-bh), ${need}px)` }}
          role="region"
          aria-label="A guide to InventDB Legal"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onFocusCapture={(e) => {
            if ((e.target as HTMLElement).matches("input")) setAuto(false);
          }}
        >
          <div className="dk-board" aria-hidden />
          <div className="dk-block">
            <Face side="front" shown={flipped >= LAST} at={LAST}>
              {finalPages}
            </Face>
          </div>
          {leaves.map((leaf, i) => {
            const isFlipped = i < flipped;
            const isTurning = turning.includes(i);
            const z = isTurning ? 50 + i : isFlipped ? i + 1 : 20 - i;
            return (
              <div
                key={i}
                className={`dk-leaf${isFlipped ? " is-flipped" : ""}${isTurning ? " is-turning" : ""}`}
                style={{ zIndex: z }}
              >
                <Face
                  side="front"
                  kind={leaf.frontKind ?? "paper"}
                  shown={i === flipped}
                  at={i}
                  onClick={(e) => {
                    if (!onControl(e)) next();
                  }}
                >
                  {leaf.front}
                </Face>
                {!narrow && leaf.back && (
                  <Face
                    side="back"
                    kind={leaf.backKind ?? "paper"}
                    shown={i === flipped - 1}
                    onClick={(e) => {
                      if (!onControl(e)) prev();
                    }}
                  >
                    {leaf.back}
                  </Face>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <nav className="dk-controls" aria-label="The guide's pages">
        <div className="dk-ctl-main">
          <button
            type="button"
            className="dk-round"
            onClick={prev}
            disabled={flipped === 0}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="dk-where-now" aria-live="polite">
            {flipped >= 2 && flipped <= 7 && (
              <b>Chapter {ROMAN[flipped - 2]}</b>
            )}
            {label}
          </span>
          <button
            type="button"
            className="dk-round"
            onClick={next}
            disabled={flipped >= LAST}
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="dk-ctl-extra">
          {flipped < LAST && !reduce && (
            <button
              type="button"
              className="dk-round"
              onClick={() => setAuto((a) => !a)}
              aria-label={auto ? "Pause the tour" : "Play the tour"}
            >
              {auto ? <Pause size={15} /> : <Play size={15} />}
            </button>
          )}
          {flipped < LAST && (
            <button
              type="button"
              className="dk-skip"
              onClick={() => jump(LAST)}
            >
              Skip to sign in
            </button>
          )}
          {flipped >= LAST && !reduce && (
            <button type="button" className="dk-tour" onClick={retour}>
              Take the tour
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
