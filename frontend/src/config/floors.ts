/**
 * The firm's groups: every section of the app, group by group.
 *
 * The signed-in frame lists them down the sidebar, each group a heading with
 * its sections under it, and the sign-in page lists them as what the firm
 * holds. Section names are the app's own labels, so nobody has to relearn
 * where anything is; the group is only the heading a firm would recognise
 * ("Compliance", not "Money").
 */
import { ENTITY_BY_NAME } from "./entities";

export interface Section {
  to: string;
  label: string;
  /** Exact match only: "/" would otherwise light up on every route. */
  end?: boolean;
  /** Show the outstanding-approvals count against this section. */
  badge?: "approvals";
}

export interface Floor {
  /** "G", "01" … "08", or "—" for the back office. */
  num: string;
  name: string;
  sections: Section[];
  /** Lookups and Settings: filed at the far end, apart from the practice. */
  back?: boolean;
}

function entity(name: string): Section {
  return { to: `/${name}`, label: ENTITY_BY_NAME[name].labelPlural };
}

export const FLOORS: Floor[] = [
  {
    num: "G",
    name: "Reception",
    sections: [{ to: "/", label: "Dashboard", end: true }],
  },
  {
    num: "01",
    name: "New Business",
    sections: [entity("intake_and_leads")],
  },
  { num: "02", name: "Client Care", sections: [entity("clients")] },
  {
    num: "03",
    name: "Case Management",
    sections: [entity("matters"), entity("timekeepers")],
  },
  {
    num: "04",
    name: "Profitability",
    sections: [entity("time_entries"), entity("costs_and_disbursements"), entity("invoices")],
  },
  {
    num: "05",
    name: "Compliance",
    sections: [
      entity("trust_ledger_cta"),
      entity("payments_and_receipts"),
      entity("settlements_and_liens"),
    ],
  },
  {
    num: "06",
    name: "Risk & Deadlines",
    sections: [entity("court_calendar"), entity("deadlines_and_sol")],
  },
  {
    num: "07",
    name: "Documents",
    sections: [
      { to: "/files", label: "Files" },
      { to: "/import", label: "Import" },
    ],
  },
  {
    num: "08",
    name: "Practice Insight",
    sections: [
      { to: "/reports", label: "Reports" },
      { to: "/analyze", label: "Analyze" },
      // The badge rides the Workflows entry because that is where a parked run
      // is answered: the count and the thing it refers to are one click apart.
      { to: "/workflows", label: "Workflows", badge: "approvals" },
    ],
  },
  {
    num: "—",
    name: "Lookups & Settings",
    sections: [entity("lookups"), { to: "/settings", label: "Settings" }],
    back: true,
  },
];

/** Every section in building order: the order Tab walks them in. */
export const SECTIONS: Section[] = FLOORS.flatMap((f) => f.sections);

/**
 * The groups one person sees: only their sections, and only the groups that
 * still hold one. `allowed` is the access map's `sections`.
 */
export function floorsFor(allowed: readonly string[]): Floor[] {
  const set = new Set(allowed);
  return FLOORS.map((f) => ({ ...f, sections: f.sections.filter((s) => set.has(s.to)) })).filter(
    (f) => f.sections.length > 0
  );
}

export function sectionsFor(allowed: readonly string[]): Section[] {
  return floorsFor(allowed).flatMap((f) => f.sections);
}

/** The first path segment, as a section's `to`. */
export function sectionPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

export function sectionOf(pathname: string): Section | undefined {
  const path = sectionPath(pathname);
  return SECTIONS.find((s) => s.to === path);
}

/** The floor a route is on. An unknown route stays in Reception. */
export function floorOf(pathname: string): Floor {
  const path = sectionPath(pathname);
  return FLOORS.find((f) => f.sections.some((s) => s.to === path)) ?? FLOORS[0];
}

