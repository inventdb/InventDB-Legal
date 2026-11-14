// The script for both films: what is on screen, where the camera goes, and
// the subtitles, in one place. The 5-minute and 3-minute cuts share the beats
// and differ in which shots they keep and how long each holds.
//
// The order follows what a law firm weighs first when it chooses practice
// management software: deadlines (malpractice), client trust money (the State
// Bar), getting paid, intake and conflicts, and then the matter file itself,
// confidentiality and the platform. Every figure quoted is true of the demo
// dataset (the fictional Alvarado & Sung LLP) as of 19 August 2026.
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
  | { kind: "stakes"; s: number; at: number[] }
  | { kind: "pair"; s: number; a: string; b: string }
  | { kind: "phones"; s: number; srcs: string[] }
  | { kind: "arch"; s: number; testsAt: number }
  | { kind: "close"; s: number };

export type Cut = { segs: Seg[]; caps: [string, number][] };
export type Beat = { id: string; chapter?: string; long: Cut; short?: Cut };

const FULL: Cam = [0, 0, 0, 1600];
const shot = (src: string, s: number, cam?: Cam[], marks?: Mark[]): Seg => ({ kind: "shot", src, s, cam, marks });
const book = (n: number, s: number): Seg => shot(`book-ch${n}`, s, [FULL, [1, 120, 40, 1360]]);
/** A record opened in the right-hand panel: the whole page, then the panel, then down it. */
const panel = (src: string, s: number, downTo: number): Seg =>
  shot(src, s, [FULL, [0.18, 840, 40, 760], [0.45, 840, 40, 760], [0.75, 840, downTo, 760], [1, 840, downTo, 760]]);

export const BEATS: Beat[] = [
  {
    id: "open",
    long: {
      segs: [{ kind: "intro", s: 11, from: "start" }],
      caps: [
        ["This is InventDB Legal.", 4],
        ["Practice management for law firms, built on InventDB SOAR.", 7],
      ],
    },
    short: {
      segs: [{ kind: "intro", s: 9, from: "start", skip: 1.2 }],
      caps: [
        ["This is InventDB Legal.", 3],
        ["Practice management for law firms, built on InventDB SOAR.", 6],
      ],
    },
  },
  {
    id: "stakes",
    long: {
      segs: [{ kind: "stakes", s: 15, at: [0, 4, 8, 11.5] }],
      caps: [
        ["A missed deadline can become a malpractice claim.", 4],
        ["A trust account error can become a State Bar complaint.", 4],
        ["Unbilled time is a fee the firm never collects.", 3.5],
        ["InventDB Legal is built around all three.", 3.5],
      ],
    },
    short: {
      segs: [{ kind: "stakes", s: 12, at: [0, 3, 6.5, 9.5] }],
      caps: [
        ["A missed deadline can become a malpractice claim.", 3],
        ["A trust account error can become a State Bar complaint.", 3.5],
        ["Unbilled time is a fee the firm never collects.", 3],
        ["InventDB Legal is built around all three.", 2.5],
      ],
    },
  },
  {
    id: "dashboard",
    chapter: "Dashboard",
    long: {
      segs: [
        { kind: "intro", s: 5, from: "form" },
        shot("dash-1", 12, [FULL, [0.2, 260, 70, 1340], [1, 260, 70, 1300]]),
      ],
      caps: [
        ["Sign in with the firm's InventDB account.", 5],
        ["The firm's day on one page: 730 open matters, 172 deadlines and 176 hearings in the next 30 days.", 6],
        ["$300,640 of unbilled work, $778,109 owed, and $1.27 million held in trust.", 6],
      ],
    },
    short: {
      segs: [
        { kind: "intro", s: 3.5, from: "form" },
        shot("dash-1", 7.5, [FULL, [0.25, 260, 70, 1340], [1, 260, 70, 1300]]),
      ],
      caps: [
        ["Sign in, and the firm's day is on one page:", 3.5],
        ["730 open matters, 172 deadlines due in 30 days, $1.27 million in trust.", 7.5],
      ],
    },
  },
  {
    id: "deadlines",
    chapter: "Deadlines & SOL",
    long: {
      segs: [
        book(3, 4),
        shot("dash-1", 5, [[0, 260, 70, 1340], [0.6, 900, 400, 760], [1, 900, 400, 760]]),
        panel("dl-1", 10, 200),
        shot("drill-2", 5, [[0, 820, 0, 780], [1, 820, 20, 740]]),
        shot("cal-1", 6, [FULL, [0.6, 430, 330, 1000], [1, 430, 330, 1000]]),
        shot("cal-2", 3.5, [[0, 820, 0, 780], [1, 820, 0, 760]]),
        shot("reports-1", 4.5, [[0, 520, 220, 960], [1, 520, 260, 900]]),
        shot("wf-4", 6, [[0, 540, 0, 1060], [1, 560, 40, 960]]),
      ],
      caps: [
        ["Deadlines first. Missed deadlines are a common cause of malpractice claims.", 5.5],
        ["The dashboard shows what falls due, soonest first.", 3.5],
        ["Each is counted from its rule: here, Rule 8.121(a), ten days from the notice of appeal.", 6],
        ["Every deadline has an owner, a priority and a count of the days remaining.", 4.5],
        ["Every matter carries its statute of limitations date.", 5],
        ["Hearings, depositions and mediations share one court calendar.", 6],
        ["Open a busy day to see every appearance.", 3.5],
        ["The docket report lists all 172 deadlines due in the next 30 days.", 4.5],
        ["And a workflow emails each attorney their critical deadlines every weekday morning.", 5.5],
      ],
    },
    short: {
      segs: [
        book(3, 2.5),
        panel("dl-1", 8, 200),
        shot("drill-2", 3, [[0, 820, 0, 780], [1, 820, 20, 740]]),
        shot("cal-1", 5, [FULL, [0.6, 430, 330, 1000], [1, 430, 330, 1000]]),
        shot("reports-1", 4.5, [[0, 520, 220, 960], [1, 520, 260, 900]]),
        shot("wf-4", 4, [[0, 540, 0, 1060], [1, 560, 40, 960]]),
      ],
      caps: [
        ["Deadlines first. Missed deadlines are a common cause of malpractice claims.", 5],
        ["Each is counted from its rule: here, Rule 8.121(a), ten days from the notice of appeal.", 5.5],
        ["Limitation dates are tracked on every matter.", 3],
        ["Hearings, depositions and mediations share one court calendar.", 5],
        ["The docket report lists everything due in the next 30 days.", 4.5],
        ["A workflow emails each attorney their critical deadlines.", 4],
      ],
    },
  },
  {
    id: "trust",
    chapter: "Client Trust",
    long: {
      segs: [
        book(6, 4),
        shot("matter-1", 5, [[0, 600, 200, 1000], [0.5, 1000, 330, 620], [1, 1020, 340, 580]]),
        shot("mtrust-1", 6, [FULL, [0.3, 840, 0, 760], [1, 840, 0, 760]]),
        shot("trust-1", 5, [[0, 250, 130, 1350], [1, 600, 130, 1000]]),
        shot("rpt-recon", 7, [[0, 540, 230, 1000], [0.5, 560, 330, 720], [1, 560, 330, 720]]),
        panel("set-1", 8, 330),
        shot("wf-1", 7, [FULL, [0.35, 640, 230, 940], [1, 640, 230, 940]]),
      ],
      caps: [
        ["Then client money: trust account errors are a common cause of State Bar discipline.", 5],
        ["Each matter shows its trust balance against its retainer and replenish threshold.", 5],
        ["Every deposit, earned-fee transfer and disbursement is entered on the client's own ledger,", 6],
        ["with a running balance for every matter, line by line.", 5],
        ["The monthly reconciliation shows bank clearance, and that no client ledger ever went below zero.", 7],
        ["Settlements show the gross, the fee, costs, each lien negotiated down, and the net to the client.", 8],
        ["When a trust balance runs low, a workflow asks a partner before requesting a top-up.", 6],
      ],
    },
    short: {
      segs: [
        book(6, 2.5),
        shot("matter-1", 4, [[0, 600, 200, 1000], [0.5, 1000, 330, 620], [1, 1020, 340, 580]]),
        shot("mtrust-1", 4.5, [[0, 600, 0, 1000], [0.4, 840, 0, 760], [1, 840, 0, 760]]),
        shot("rpt-recon", 6, [[0, 540, 230, 1000], [0.5, 560, 330, 720], [1, 560, 330, 720]]),
        panel("set-1", 8, 330),
      ],
      caps: [
        ["Then client money: trust errors are a common cause of State Bar discipline.", 5],
        ["Every deposit, transfer and disbursement is entered on the client's own ledger.", 6],
        ["The monthly reconciliation shows no client ledger ever went below zero.", 6],
        ["Settlements show the gross, the fee, costs, each lien and the net to the client.", 8],
      ],
    },
  },
  {
    id: "billing",
    chapter: "Billing",
    long: {
      segs: [
        book(5, 4),
        shot("time-1", 4, [FULL, [1, 270, 110, 1150]]),
        panel("te-1", 7, 300),
        shot("reports-2", 6, [[0, 520, 200, 960], [1, 520, 260, 880]]),
        panel("inv-1", 7, 260),
        shot("rpt-ar", 7, [[0, 540, 230, 1000], [0.5, 560, 260, 860], [1, 560, 260, 860]]),
        shot("reports-4", 5, [FULL, [0.5, 880, 140, 720], [1, 880, 140, 720]]),
      ],
      caps: [
        ["Billing: hours never recorded are fees never collected.", 4],
        ["Time is entered against the matter, as the work is done.", 4],
        ["Each entry carries UTBMS phase, task and activity codes, the coding insurers and corporate clients ask for.", 7],
        ["Unbilled work is valued at standard rates: $300,640 across the firm.", 6],
        ["Invoices show fees, write-downs, costs, payments applied from trust and the balance due.", 7],
        ["Receivables are aged by client, so the $216,788 over 120 days gets chased first.", 7],
        ["Change any report by describing the change. Each edit saves a new version.", 5],
      ],
    },
    short: {
      segs: [
        book(5, 2.5),
        panel("te-1", 6, 300),
        shot("reports-2", 4.5, [[0, 520, 200, 960], [1, 520, 260, 880]]),
        panel("inv-1", 5, 260),
        shot("rpt-ar", 5, [[0, 540, 230, 1000], [0.5, 560, 260, 860], [1, 560, 260, 860]]),
      ],
      caps: [
        ["Billing: every hour counts.", 2.5],
        ["Time carries UTBMS phase, task and activity codes, the coding insurers ask for.", 6],
        ["Unbilled work: $300,640 at standard rates.", 4.5],
        ["Invoices show write-downs, trust applied and the balance due.", 5],
        ["Receivables are aged, so the oldest money gets chased first.", 5],
      ],
    },
  },
  {
    id: "analyze",
    chapter: "Analyze",
    long: {
      segs: [
        shot("analyze-1", 4, [[0, 270, 100, 1100], [1, 270, 100, 1000]]),
        shot("analyze-2", 9, [[0, 520, 100, 1080], [0.5, 520, 100, 1080], [1, 520, 330, 1080]]),
        shot("analyze-4", 9, [[0, 560, 100, 1040], [0.4, 560, 420, 1040], [1, 560, 440, 1000]], [[0.45, 618, 630, 930, 56]]),
      ],
      caps: [
        ["Partners can ask the practice a question in plain English.", 4],
        ["Analyze plans the queries and answers with a chart.", 4],
        ["Business Litigation holds the most unbilled work: $125,158.50.", 5],
        ["Every answer shows the SQL behind it, so the figure can be checked.", 5],
        ["It only reads. Changes come back as proposals to approve.", 4],
      ],
    },
    short: {
      segs: [
        shot("analyze-1", 3, [[0, 270, 100, 1100], [1, 270, 100, 1000]]),
        shot("analyze-2", 5.5, [[0, 520, 100, 1080], [1, 520, 300, 1080]]),
        shot("analyze-4", 5.5, [[0, 560, 300, 1040], [1, 560, 420, 1040]], [[0.3, 618, 630, 930, 56]]),
      ],
      caps: [
        ["Ask the practice a question in plain English.", 3],
        ["Business Litigation holds the most unbilled work: $125,158.50.", 5.5],
        ["Every answer shows its SQL. Analyze only reads.", 5.5],
      ],
    },
  },
  {
    id: "intake",
    chapter: "Intake & Conflicts",
    long: {
      segs: [
        book(1, 3.5),
        shot("intake-1", 4.5, [FULL, [1, 270, 110, 1150]]),
        panel("lead-1", 7, 230),
        shot("wf-3", 7, [[0, 600, 190, 1000], [0.5, 600, 190, 1000], [1, 600, 400, 1000]]),
      ],
      caps: [
        ["New business: every enquiry is logged with its source and claim type.", 5],
        ["Intake shows each enquiry, newest first.", 3],
        ["The statute of limitations is worked out the day the enquiry arrives: here, 360 days to run.", 7],
        ["A workflow runs the conflict check and waits for a person to clear it before anyone gives advice.", 7],
      ],
    },
    short: {
      segs: [book(1, 2), panel("lead-1", 5.5, 230), shot("wf-3", 5.5, [[0, 600, 190, 1000], [1, 600, 300, 1000]])],
      caps: [
        ["New business.", 2],
        ["The statute of limitations is worked out the day an enquiry arrives.", 5.5],
        ["A conflict check runs, and a person clears it before anyone gives advice.", 5.5],
      ],
    },
  },
  {
    id: "matters",
    chapter: "Matters",
    long: {
      segs: [
        book(2, 3),
        shot("matters-1", 4.5, [FULL, [1, 270, 150, 1050]], [[0.4, 1040, 200, 120, 26]]),
        shot("matters-3", 4, [[0, 270, 150, 1050], [1, 270, 150, 1000]], [[0.2, 430, 196, 420, 40]]),
        shot("matter-1", 6, [FULL, [0.35, 280, 140, 900], [1, 280, 140, 880]]),
        shot("drill-2", 5, [[0, 800, 330, 800], [1, 800, 380, 800]]),
        shot("describe-2", 4.5, [[0, 930, 0, 670], [1, 930, 10, 670]]),
        shot("describe-3", 5, [[0, 930, 0, 670], [1, 930, 220, 670]]),
        shot("files-1", 5, [FULL, [1, 260, 120, 1300]]),
      ],
      caps: [
        ["Every matter is one file, and every part of the firm reads from it.", 4.5],
        ["1,300 matters in the demo firm.", 3],
        ["Search runs across the whole database, not just the page on screen.", 4],
        ["Court, judge, case number, fee terms, the team, and a Privileged mark on every matter.", 6],
        ["Open any record read-only, with its linked records and the papers filed under it.", 5],
        ["Open a new matter by describing it in plain English.", 4.5],
        ["The form fills itself, and nothing is saved until someone checks it.", 5],
        ["Documents are filed by matter and found by name, by the text inside or by meaning.", 5],
      ],
    },
    short: {
      segs: [
        book(2, 2),
        shot("matters-1", 3.5, [FULL, [1, 270, 150, 1050]], [[0.35, 1040, 200, 120, 26]]),
        shot("matter-1", 5, [FULL, [0.4, 280, 140, 900], [1, 280, 140, 880]]),
        shot("drill-2", 3.5, [[0, 800, 330, 800], [1, 800, 380, 800]]),
        shot("describe-3", 4, [[0, 930, 0, 670], [1, 930, 200, 670]]),
      ],
      caps: [
        ["Every matter is one file: 1,300 of them in the demo firm.", 5.5],
        ["Court, judge, case number, fee terms, the team, marked Privileged.", 5],
        ["Its papers are filed with it.", 3.5],
        ["New matters can be described in plain English.", 4],
      ],
    },
  },
  {
    id: "access",
    chapter: "Confidentiality",
    long: {
      segs: [
        { kind: "pair", s: 8, a: "dash-1", b: "role-paralegal" },
        { kind: "phones", s: 7, srcs: ["phone-1", "phone-2", "phone-3"] },
        shot("dark-1", 4, [FULL, [1, 270, 90, 1250]]),
        shot("dark-2", 5, [FULL, [1, 270, 90, 1300]]),
      ],
      caps: [
        ["Confidentiality: each person sees only the parts of the firm their work needs.", 5],
        ["Enforced by InventDB, the API and the app.", 3],
        ["On a phone at the courthouse, the calendar and the matter are a tap away.", 7],
        ["Light or dark, on any screen.", 4],
        ["The same practice and the same data, wherever the team works.", 5],
      ],
    },
    short: {
      segs: [
        { kind: "pair", s: 6, a: "dash-1", b: "role-paralegal" },
        { kind: "phones", s: 4, srcs: ["phone-1", "phone-2", "phone-3"] },
        shot("dark-1", 3, [FULL, [1, 270, 90, 1250]]),
      ],
      caps: [
        ["Each person sees only the parts of the firm their work needs.", 6],
        ["It works on a phone at the courthouse,", 4],
        ["in light or dark.", 3],
      ],
    },
  },
  {
    id: "tech",
    chapter: "Under the Hood",
    long: {
      segs: [{ kind: "arch", s: 18, testsAt: 14.5 }],
      caps: [
        ["Under the hood: a React and TypeScript app, a thin Python API, and InventDB SOAR.", 5],
        ["InventDB is the database and the identity provider. No second datastore.", 4.5],
        ["The API keeps no credentials, so row-level security applies to every request.", 5],
        ["Covered by 1,300+ backend tests and 600+ end-to-end tests.", 3.5],
      ],
    },
    short: {
      segs: [{ kind: "arch", s: 9, testsAt: 5.5 }],
      caps: [
        ["Built on InventDB SOAR: one database, its sign-in, and row-level security on every request.", 5.5],
        ["Covered by 1,300+ backend and 600+ end-to-end tests.", 3.5],
      ],
    },
  },
  {
    id: "close",
    long: {
      segs: [{ kind: "close", s: 8 }],
      caps: [
        ["InventDB Legal: the docket, client trust and billing in one place.", 4.5],
        ["Built on InventDB SOAR. inventdb.com", 3.5],
      ],
    },
    short: {
      segs: [{ kind: "close", s: 6 }],
      caps: [
        ["InventDB Legal: the docket, client trust and billing in one place.", 4],
        ["inventdb.com", 2],
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
