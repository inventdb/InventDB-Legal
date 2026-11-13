/**
 * Each tier's dashboard, as data.
 *
 * A board is a row of KPI tiles over a set of short list panels. Both are
 * picked per tier from the two catalogues below; `RoleBoard.tsx` draws whatever
 * this table says and contains no tier logic of its own. To change what a group
 * of people sees on arrival, change its row in `BOARDS`.
 *
 * The backend sends only the figures and lists a tier may read
 * (`/api/dashboard/summary`, `/api/dashboard/panels`), so a tile listed here
 * that the tier cannot read simply does not appear. Nothing on a board names
 * the tier: headings describe the work, not the person.
 */
import type { Tier } from "../config/access";

export type TileFormat = "count" | "hours" | "money";

export interface TileDef {
  label: string;
  /** Dotted path into the summary payload: "deadlines.overdue". */
  path: string;
  format: TileFormat;
  /** Section the tile opens. */
  to: string;
  note?: string;
  /** Drawn as needing attention when the figure is above zero. */
  alertAbove0?: boolean;
}

export interface PanelColumn {
  field: string;
  format?: "date" | "money" | "hours";
}

export interface PanelDef {
  title: string;
  /** Section the "All" link opens. */
  to: string;
  /** The row's headline field, then up to two quieter ones. */
  main: string;
  meta: PanelColumn[];
  empty: string;
}

export const TILES = {
  openMatters: { label: "Open matters", path: "matters.open", format: "count", to: "/matters" },
  activeClients: { label: "Active clients", path: "clients.active", format: "count", to: "/clients" },
  overdue: {
    label: "Overdue deadlines",
    path: "deadlines.overdue",
    format: "count",
    to: "/deadlines_and_sol",
    alertAbove0: true,
  },
  due30: {
    label: "Deadlines, next 30 days",
    path: "deadlines.due_30d",
    format: "count",
    to: "/deadlines_and_sol",
  },
  hearings30: {
    label: "Hearings, next 30 days",
    path: "calendar.upcoming_30d",
    format: "count",
    to: "/court_calendar",
  },
  hoursMonth: { label: "Hours this month", path: "time.hours_month", format: "hours", to: "/time_entries" },
  unbilledHours: {
    label: "Unbilled hours",
    path: "time.unbilled_hours",
    format: "hours",
    to: "/time_entries",
  },
  wip: { label: "Work in progress", path: "time.wip_value", format: "money", to: "/time_entries", note: "unbilled, at standard rates" },
  billedMonth: { label: "Billed this month", path: "financials.billed_month", format: "money", to: "/invoices" },
  collectedMonth: {
    label: "Collected this month",
    path: "financials.collected_month",
    format: "money",
    to: "/payments_and_receipts",
  },
  arOutstanding: { label: "Receivables", path: "financials.ar_outstanding", format: "money", to: "/invoices", note: "unpaid invoices" },
  trustBalance: { label: "Trust balance", path: "financials.trust_balance", format: "money", to: "/trust_ledger_cta" },
  leadsMonth: { label: "New enquiries this month", path: "intake.month", format: "count", to: "/intake_and_leads" },
  leadsTotal: { label: "Enquiries on file", path: "intake.total", format: "count", to: "/intake_and_leads" },
} satisfies Record<string, TileDef>;

/** Keys match `/api/dashboard/panels?names=`. */
export const PANELS = {
  overdue: {
    title: "Overdue",
    to: "/deadlines_and_sol",
    main: "description",
    meta: [{ field: "matter_caption" }, { field: "due_date", format: "date" }],
    empty: "Nothing overdue.",
  },
  deadlines: {
    title: "Coming due",
    to: "/deadlines_and_sol",
    main: "description",
    meta: [{ field: "matter_caption" }, { field: "due_date", format: "date" }],
    empty: "No open deadlines ahead.",
  },
  hearings: {
    title: "In court next",
    to: "/court_calendar",
    main: "matter_caption",
    meta: [{ field: "court_location" }, { field: "date", format: "date" }],
    empty: "Nothing on the calendar.",
  },
  matters: {
    title: "Recently opened matters",
    to: "/matters",
    main: "matter_caption",
    meta: [{ field: "client_name" }, { field: "stage" }],
    empty: "No open matters.",
  },
  leads: {
    title: "Latest enquiries",
    to: "/intake_and_leads",
    main: "prospect_name",
    meta: [{ field: "potential_claim_type" }, { field: "date_received", format: "date" }],
    empty: "No enquiries yet.",
  },
  clients: {
    title: "Newest clients",
    to: "/clients",
    main: "client_name",
    meta: [{ field: "conflict_check_result" }, { field: "intake_date", format: "date" }],
    empty: "No clients yet.",
  },
  time: {
    title: "Latest time",
    to: "/time_entries",
    main: "matter_caption",
    meta: [{ field: "timekeeper" }, { field: "hours", format: "hours" }],
    empty: "No time recorded yet.",
  },
  invoices: {
    title: "Unpaid invoices",
    to: "/invoices",
    main: "client_name",
    meta: [{ field: "due_date", format: "date" }, { field: "balance_due", format: "money" }],
    empty: "Every invoice is paid.",
  },
  trust: {
    title: "Trust account activity",
    to: "/trust_ledger_cta",
    main: "client_name",
    meta: [{ field: "date", format: "date" }, { field: "amount_in", format: "money" }],
    empty: "No trust activity yet.",
  },
} satisfies Record<string, PanelDef>;

export type TileKey = keyof typeof TILES;
export type PanelKey = keyof typeof PANELS;

export interface Board {
  /** Line under the greeting. Describes the work, never the person's role. */
  intro: string;
  tiles: TileKey[];
  panels: PanelKey[];
  /** The personal widget board (SQL widgets, Suggest) below the role board. */
  widgets: boolean;
}

export const BOARDS: Record<Tier, Board> = {
  admin: {
    intro: "The whole practice today: the docket, the work and the money.",
    tiles: ["openMatters", "overdue", "due30", "hearings30", "wip", "arOutstanding", "collectedMonth", "trustBalance"],
    panels: ["overdue", "deadlines", "invoices", "leads"],
    widgets: true,
  },
  partner: {
    intro: "Your practice today: what is due, who is in court, and what is owed.",
    tiles: ["openMatters", "overdue", "due30", "hearings30", "wip", "billedMonth", "collectedMonth", "arOutstanding"],
    panels: ["overdue", "hearings", "invoices", "matters"],
    widgets: true,
  },
  attorney: {
    intro: "Your docket today: deadlines, hearings and the time you have recorded.",
    tiles: ["openMatters", "overdue", "due30", "hearings30", "hoursMonth", "unbilledHours"],
    panels: ["overdue", "deadlines", "hearings", "matters"],
    widgets: true,
  },
  paralegal: {
    intro: "The docket today: what falls due, what is in court, and the latest time.",
    tiles: ["overdue", "due30", "hearings30", "openMatters", "hoursMonth"],
    panels: ["deadlines", "hearings", "overdue", "time"],
    widgets: false,
  },
  intake: {
    intro: "New business today: the latest enquiries and the clients they became.",
    tiles: ["leadsMonth", "leadsTotal", "activeClients", "openMatters"],
    panels: ["leads", "clients"],
    widgets: false,
  },
  finance: {
    intro: "Time to cash today: billing, collections, receivables and the trust account.",
    tiles: ["billedMonth", "collectedMonth", "arOutstanding", "trustBalance", "wip", "unbilledHours"],
    panels: ["invoices", "trust", "time"],
    widgets: true,
  },
};
