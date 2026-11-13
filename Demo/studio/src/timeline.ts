// The script for both films: what is on screen, where the camera goes, and
// the subtitles, in one place. The 5-minute and 3-minute cuts share the beats
// and differ in which shots they keep and how long each holds.
//
// Coordinates are CSS pixels of the captured page (1600 x 900). A camera key
// is [at, x, y, w]: at `at` (0..1 through the shot) the window shows the
// 16:9 region starting at (x, y), `w` wide. Highlights are drawn outlines,
// [at, x, y, w, h]. Everything moves or is drawn; nothing fades or pulses.
//
// No file here imports anything, so scripts/subtitles.ts can read it with
// plain Node.

export type Cam = [number, number, number, number];
export type Mark = [number, number, number, number, number];

export type Seg =
  | { kind: "shot"; src: string; s: number; cam?: Cam[]; marks?: Mark[] }
  | { kind: "intro"; s: number; from: "start" | "form"; skip?: number }
  | { kind: "card"; s: number }
  | { kind: "pair"; s: number; a: string; b: string }
  | { kind: "phones"; s: number; srcs: string[] }
  | { kind: "arch"; s: number }
  | { kind: "close"; s: number };

export type Cut = { segs: Seg[]; caps: [string, number][] };
export type Beat = { id: string; chapter?: string; long: Cut; short?: Cut };

const FULL: Cam = [0, 0, 0, 1600];
const shot = (src: string, s: number, cam?: Cam[], marks?: Mark[]): Seg => ({ kind: "shot", src, s, cam, marks });
const book = (n: number, s: number): Seg => shot(`book-ch${n}`, s, [FULL, [1, 120, 40, 1360]]);

export const BEATS: Beat[] = [
  {
    id: "open",
    long: {
      segs: [{ kind: "intro", s: 12, from: "start" }],
      caps: [
        ["This is InventDB Legal.", 4.5],
        ["Practice management for law firms, built on InventDB SOAR.", 7.5],
      ],
    },
    short: {
      segs: [{ kind: "intro", s: 9, from: "start", skip: 1.2 }],
      caps: [
        ["This is InventDB Legal.", 3.5],
        ["Practice management for law firms, built on InventDB SOAR.", 5.5],
      ],
    },
  },
  {
    id: "promise",
    long: {
      segs: [{ kind: "card", s: 9 }],
      caps: [
        ["Most firms keep matters, the docket, billing and client money in separate systems.", 5],
        ["InventDB Legal keeps the whole practice in one place.", 4],
      ],
    },
    short: {
      segs: [{ kind: "card", s: 6 }],
      caps: [["One place for the whole practice: matters, the docket, time, billing and client money.", 6]],
    },
  },
  {
    id: "dashboard",
    long: {
      segs: [
        { kind: "intro", s: 5, from: "form" },
        shot("dash-1", 16, [FULL, [0.25, 260, 70, 1340], [0.62, 260, 70, 1340], [0.85, 890, 400, 720], [1, 890, 400, 720]]),
      ],
      caps: [
        ["Sign in with your InventDB account.", 5],
        ["Each person lands on their own dashboard.", 3.5],
        ["Open matters, deadlines, hearings, unbilled work, receivables and the trust balance.", 6],
        ["And what is coming due, soonest first.", 6.5],
      ],
    },
    short: {
      segs: [
        { kind: "intro", s: 4, from: "form" },
        shot("dash-1", 10, [FULL, [0.3, 260, 70, 1340], [1, 260, 70, 1340]]),
      ],
      caps: [
        ["Sign in, and each person lands on their own dashboard.", 5],
        ["The whole practice at a glance: matters, deadlines, hearings and the money.", 9],
      ],
    },
  },
  {
    id: "new-business",
    chapter: "I · New Business",
    long: {
      segs: [
        book(1, 4),
        shot("intake-1", 5, [FULL, [1, 270, 110, 1150]]),
        shot("wf-3", 6, [[0, 600, 190, 1000], [0.55, 600, 190, 1000], [1, 600, 480, 1000]]),
      ],
      caps: [
        ["New business: an enquiry becomes a client.", 4],
        ["Every enquiry is logged with where it came from and what it is about.", 5],
        ["A workflow runs the conflict check, then waits for a person to decide.", 6],
      ],
    },
    short: {
      segs: [book(1, 2.5), shot("wf-3", 6.5, [[0, 600, 190, 1000], [1, 600, 300, 1000]])],
      caps: [
        ["New business: an enquiry becomes a client.", 2.5],
        ["A workflow runs the conflict check, then waits for a person to decide.", 6.5],
      ],
    },
  },
  {
    id: "case",
    chapter: "II · Case Management",
    long: {
      segs: [
        book(2, 4),
        shot("matters-1", 5, [FULL, [1, 270, 150, 1050]], [[0.4, 1040, 200, 120, 26]]),
        shot("matters-2", 4, [[0, 250, 140, 1350], [1, 250, 140, 1250]]),
        shot("matters-3", 5, [[0, 270, 150, 1050], [1, 270, 150, 1000]], [[0.2, 430, 196, 420, 40]]),
        shot("matter-1", 8, [FULL, [0.3, 280, 140, 900], [0.6, 280, 140, 900], [0.85, 1000, 330, 620], [1, 1000, 330, 620]]),
        shot("matter-3", 6, [[0, 280, 330, 1050], [1, 280, 330, 980]]),
        shot("drill-1", 5, [FULL, [0.4, 800, 0, 800], [1, 800, 0, 800]]),
        shot("drill-2", 5, [[0, 800, 330, 800], [1, 800, 380, 800]]),
      ],
      caps: [
        ["Case management: one file for every matter.", 4],
        ["The demo firm has 1,300 matters, shown as a docket or as a table.", 5],
        ["Each list can be sorted and paged like a spreadsheet.", 4],
        ["Search runs across the whole table in the database, not just the page on screen.", 5],
        ["A matter holds the court, judge, case number, fee terms and the team on it.", 4.5],
        ["Its trust balance sits beside it.", 3.5],
        ["Related shows everything that points at it: 93 time entries, costs, invoices and the trust ledger.", 6],
        ["Click any record, chart or report row, and a read-only panel opens it.", 5],
        ["With its links and the papers filed under it.", 5],
      ],
    },
    short: {
      segs: [
        book(2, 3),
        shot("matters-1", 4, [FULL, [1, 270, 150, 1050]], [[0.35, 1040, 200, 120, 26]]),
        shot("matter-1", 6, [FULL, [0.4, 280, 140, 900], [1, 1000, 330, 620]]),
        shot("matter-3", 5, [[0, 280, 330, 1050], [1, 280, 330, 980]]),
        shot("drill-1", 5, [FULL, [0.45, 800, 0, 800], [1, 800, 0, 800]]),
      ],
      caps: [
        ["Case management: one file for every matter.", 3],
        ["The demo firm has 1,300 matters, shown as a docket or as a table.", 4],
        ["A matter holds the court, judge, case number, fee terms and its trust balance.", 6],
        ["Related shows everything that points at it: time, costs, invoices, trust.", 5],
        ["Click any record, and a read-only panel opens it with its links and files.", 5],
      ],
    },
  },
  {
    id: "describe",
    chapter: "II · Case Management",
    long: {
      segs: [
        shot("describe-2", 6, [[0, 930, 0, 670], [1, 930, 10, 670]]),
        shot("describe-3", 7, [[0, 930, 0, 670], [0.45, 930, 0, 670], [1, 930, 260, 670]]),
      ],
      caps: [
        ["Describe a new matter in plain English.", 6],
        ["The form fills itself. Nothing is saved until you check it and press Save.", 7],
      ],
    },
    short: {
      segs: [
        shot("describe-2", 4, [[0, 930, 0, 670], [1, 930, 10, 670]]),
        shot("describe-3", 5, [[0, 930, 0, 670], [1, 930, 200, 670]]),
      ],
      caps: [
        ["Describe a new matter in plain English.", 4],
        ["The form fills itself. Nothing saves until you press Save.", 5],
      ],
    },
  },
  {
    id: "deadlines",
    chapter: "III · Risk & Deadlines",
    long: {
      segs: [
        book(3, 4),
        shot("cal-1", 7, [FULL, [0.5, 430, 330, 1000], [1, 430, 330, 1000]]),
        shot("cal-2", 5, [[0, 820, 0, 780], [1, 820, 0, 780]]),
        shot("reports-1", 6, [[0, 520, 220, 960], [1, 520, 260, 900]]),
      ],
      caps: [
        ["Risk and deadlines: nothing missed.", 4],
        ["Hearings, depositions and mediations on one calendar, in court and out of court told apart.", 7],
        ["Click a busy day to see all of it.", 5],
        ["Every deadline carries its rule, trigger and owner. 172 fall due in the next 30 days.", 6],
      ],
    },
    short: {
      segs: [
        book(3, 2.5),
        shot("cal-1", 5, [FULL, [1, 430, 330, 1000]]),
        shot("reports-1", 4.5, [[0, 520, 220, 960], [1, 520, 260, 900]]),
      ],
      caps: [
        ["Risk and deadlines: nothing missed.", 2.5],
        ["Hearings, depositions and mediations on one calendar.", 5],
        ["Every deadline carries its rule, trigger and owner.", 4.5],
      ],
    },
  },
  {
    id: "documents",
    chapter: "IV · Documents",
    long: {
      segs: [book(4, 4), shot("files-1", 8, [FULL, [1, 260, 120, 1300]])],
      caps: [
        ["Documents: every paper in its place.", 4],
        ["Files are kept by matter and folder, and found by name, by the text inside or by meaning.", 8],
      ],
    },
    short: {
      segs: [book(4, 2.5), shot("files-1", 3.5, [FULL, [1, 260, 120, 1300]])],
      caps: [
        ["Documents: every paper in its place,", 2.5],
        ["found by name, by the text inside or by meaning.", 3.5],
      ],
    },
  },
  {
    id: "profit",
    chapter: "V · Profitability",
    long: {
      segs: [
        book(5, 4),
        shot("time-1", 5, [FULL, [1, 270, 110, 1150]]),
        shot("invoices-1", 5, [FULL, [1, 270, 110, 1150]]),
        shot("reports-2", 7, [[0, 520, 200, 960], [1, 520, 260, 880]]),
      ],
      caps: [
        ["Profitability: every hour accounted for.", 4],
        ["Time is recorded against the matter, with UTBMS task and activity codes.", 5],
        ["Invoices show what was billed, what was paid and how late the rest is.", 5],
        ["A live report lists unbilled work matter by matter, at standard rates.", 7],
      ],
    },
    short: {
      segs: [book(5, 2.5), shot("time-1", 4, [FULL, [1, 270, 110, 1150]]), shot("reports-2", 4.5, [[0, 520, 200, 960], [1, 520, 260, 880]])],
      caps: [
        ["Profitability: every hour accounted for.", 2.5],
        ["Time is recorded against the matter, with UTBMS codes.", 4],
        ["A live report lists unbilled work, matter by matter.", 4.5],
      ],
    },
  },
  {
    id: "compliance",
    chapter: "VI · Compliance",
    long: {
      segs: [
        book(6, 4),
        shot("trust-1", 6, [[0, 250, 130, 1350], [1, 250, 130, 1200]]),
        shot("matter-1", 4, [[0, 1000, 330, 620], [1, 1040, 360, 560]]),
        shot("settle-1", 5, [FULL, [1, 270, 110, 1150]]),
      ],
      caps: [
        ["Compliance: client money, by the book.", 4],
        ["The trust ledger records every deposit, transfer and disbursement.", 6],
        ["Each matter shows its trust balance against its replenish threshold.", 4],
        ["Settlements record the gross, the fee, costs, liens and the net to the client.", 5],
      ],
    },
    short: {
      segs: [book(6, 2.5), shot("trust-1", 4, [[0, 250, 130, 1350], [1, 250, 130, 1200]]), shot("settle-1", 3.5, [FULL, [1, 270, 110, 1150]])],
      caps: [
        ["Compliance: client money, by the book.", 2.5],
        ["Every trust deposit, transfer and disbursement is recorded,", 4],
        ["through to settlements and the net to the client.", 3.5],
      ],
    },
  },
  {
    id: "analyze",
    chapter: "Analyze",
    long: {
      segs: [
        shot("analyze-1", 5, [[0, 270, 100, 1100], [1, 270, 100, 1000]]),
        shot("analyze-2", 9, [[0, 520, 100, 1080], [0.5, 520, 100, 1080], [1, 520, 330, 1080]]),
        shot("analyze-4", 7, [[0, 560, 100, 1040], [0.4, 560, 100, 1040], [1, 560, 420, 1040]], [[0.55, 618, 630, 930, 56]]),
        shot("analyze-4", 5, [[0, 560, 420, 1040], [1, 560, 440, 1000]]),
      ],
      caps: [
        ["Analyze: ask the practice a question in plain English.", 5],
        ["It plans, runs the queries, and answers with a chart.", 4],
        ["Business Litigation carries the most unbilled work: $125,158.50.", 5],
        ["Every answer shows the SQL behind it, so anyone can check it.", 7],
        ["Analyze only reads. A change comes back as a proposal for you to approve.", 5],
      ],
    },
    short: {
      segs: [
        shot("analyze-1", 4, [[0, 270, 100, 1100], [1, 270, 100, 1000]]),
        shot("analyze-2", 7, [[0, 520, 100, 1080], [1, 520, 300, 1080]]),
        shot("analyze-4", 7, [[0, 560, 300, 1040], [1, 560, 420, 1040]], [[0.3, 618, 630, 930, 56]]),
      ],
      caps: [
        ["Analyze: ask the practice a question in plain English.", 4],
        ["It runs the queries and answers with a chart.", 3],
        ["Business Litigation carries the most unbilled work: $125,158.50.", 4],
        ["Every answer shows its SQL. Analyze only reads; changes come back as proposals.", 7],
      ],
    },
  },
  {
    id: "reports",
    chapter: "Reports",
    long: {
      segs: [shot("reports-3", 5, [[0, 520, 200, 960], [1, 520, 240, 900]]), shot("reports-4", 7, [FULL, [0.5, 880, 140, 720], [1, 880, 140, 720]])],
      caps: [
        ["Live reports re-query the data every time they open.", 5],
        ["Change one by describing the change. Every edit saves a new version.", 7],
      ],
    },
    short: {
      segs: [shot("reports-4", 7, [FULL, [0.5, 880, 140, 720], [1, 880, 140, 720]])],
      caps: [["Live reports re-query on open. Edit one by describing the change.", 7]],
    },
  },
  {
    id: "workflows",
    chapter: "Workflows",
    long: {
      segs: [
        shot("wf-1", 8, [FULL, [0.45, 640, 230, 940], [1, 640, 230, 940]]),
        shot("wf-3", 6, [[0, 600, 400, 1000], [1, 600, 480, 1000]]),
        shot("wf-4", 8, [[0, 540, 0, 1060], [1, 560, 40, 960]]),
      ],
      caps: [
        ["Workflows automate the routine: scheduled reports, alerts and approvals.", 4.5],
        ["When a run needs a decision, it stops and asks.", 4],
        ["Answering resumes that same run, and its trail shows every step it took.", 6],
        ["Rehearse a workflow before it goes live. Every run is kept.", 7.5],
      ],
    },
    short: {
      segs: [shot("wf-1", 6, [FULL, [0.5, 640, 230, 940], [1, 640, 230, 940]]), shot("wf-4", 5.5, [[0, 540, 0, 1060], [1, 560, 40, 960]])],
      caps: [
        ["Workflows automate the routine. When one needs a decision, it stops and asks.", 6],
        ["Rehearse before going live. Every run is kept.", 5.5],
      ],
    },
  },
  {
    id: "platform",
    chapter: "The Platform",
    long: {
      segs: [
        { kind: "pair", s: 8, a: "dash-1", b: "role-paralegal" },
        shot("search-1", 5, [[0, 160, 0, 960], [1, 160, 0, 900]]),
        shot("dark-1", 5, [FULL, [1, 270, 90, 1250]]),
        { kind: "phones", s: 8, srcs: ["phone-1", "phone-2", "phone-3"] },
      ],
      caps: [
        ["Everyone lands on their own dashboard and sees only their part of the firm.", 4.5],
        ["Access is enforced by InventDB, by the API and by the app.", 3.5],
        ["Search the whole firm from anywhere.", 5],
        ["Light or dark, to suit the room.", 5],
        ["And the whole practice works on a phone.", 8],
      ],
    },
    short: {
      segs: [
        { kind: "pair", s: 6, a: "dash-1", b: "role-paralegal" },
        shot("search-1", 3.5, [[0, 160, 0, 960], [1, 160, 0, 900]]),
        shot("dark-1", 3, [FULL, [1, 270, 90, 1250]]),
        { kind: "phones", s: 4, srcs: ["phone-1", "phone-2", "phone-3"] },
      ],
      caps: [
        ["Everyone sees only their part of the firm, enforced by InventDB, the API and the app.", 6],
        ["Search the whole firm from anywhere.", 3.5],
        ["Light or dark,", 3],
        ["and it works on a phone.", 4],
      ],
    },
  },
  {
    id: "tech",
    chapter: "Under the Hood",
    long: {
      segs: [{ kind: "arch", s: 20 }],
      caps: [
        ["Under the hood: a React and TypeScript app, a thin Python API, and InventDB SOAR.", 5],
        ["InventDB is the database and the identity provider. No second datastore.", 4.5],
        ["The API keeps no credentials and forwards each person's own token,", 4],
        ["so row-level security applies to every request.", 3],
        ["Covered by 1,300+ backend tests and 600+ end-to-end tests.", 3.5],
      ],
    },
    short: {
      segs: [{ kind: "arch", s: 12 }],
      caps: [
        ["Under the hood: React and TypeScript, a thin Python API, and InventDB SOAR.", 4.5],
        ["InventDB is the database and the identity provider. No second datastore.", 4.5],
        ["Row-level security applies to every request.", 3],
      ],
    },
  },
  {
    id: "close",
    long: {
      segs: [{ kind: "close", s: 8 }],
      caps: [
        ["InventDB Legal. The whole practice, in one place.", 4.5],
        ["Built on InventDB SOAR. inventdb.com", 3.5],
      ],
    },
    short: {
      segs: [{ kind: "close", s: 6 }],
      caps: [
        ["InventDB Legal. The whole practice, in one place.", 3.5],
        ["Built on InventDB SOAR. inventdb.com", 2.5],
      ],
    },
  },
];

export const FPS = 30;

export type Placed = { seg: Seg; start: number; end: number; chapter?: string; beat: string };
export type Caption = { text: string; start: number; end: number };

/** Lay a cut out on one timeline, in seconds. */
export function layout(cut: "long" | "short") {
  const segs: Placed[] = [];
  const caps: Caption[] = [];
  let t = 0;
  for (const beat of BEATS) {
    const c = cut === "short" ? beat.short ?? beat.long : beat.long;
    let s = t;
    for (const seg of c.segs) {
      segs.push({ seg, start: s, end: s + seg.s, chapter: beat.chapter, beat: beat.id });
      s += seg.s;
    }
    let k = t;
    for (const [text, d] of c.caps) {
      caps.push({ text, start: k, end: k + d });
      k += d;
    }
    const segTotal = s - t;
    const capTotal = k - t;
    if (Math.abs(segTotal - capTotal) > 0.01) {
      throw new Error(`${cut}/${beat.id}: shots last ${segTotal}s but captions ${capTotal}s`);
    }
    t = s;
  }
  return { segs, caps, total: t };
}
