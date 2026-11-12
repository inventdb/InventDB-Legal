/**
 * The building: every section of the app, floor by floor.
 *
 * The login page draws the firm with these floors, and the signed-in app files
 * its sections under the same ones, as folder tabs. Section names are the
 * app's own labels, so nobody has to relearn where anything is; the floor is
 * only the grouping a firm would recognise ("Compliance", not "Money").
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
  /** The line under the floor's name, set in italic serif. */
  script: string;
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
    script: "every client, welcomed",
    sections: [{ to: "/", label: "Dashboard", end: true }],
  },
  {
    num: "01",
    name: "New Business",
    script: "every enquiry, captured",
    sections: [entity("intake_and_leads")],
  },
  { num: "02", name: "Client Care", script: "every client, known", sections: [entity("clients")] },
  {
    num: "03",
    name: "Case Management",
    script: "every matter, in order",
    sections: [entity("matters"), entity("timekeepers")],
  },
  {
    num: "04",
    name: "Profitability",
    script: "every hour counts",
    sections: [entity("time_entries"), entity("costs_and_disbursements"), entity("invoices")],
  },
  {
    num: "05",
    name: "Compliance",
    script: "client funds, by the book",
    sections: [
      entity("trust_ledger_cta"),
      entity("payments_and_receipts"),
      entity("settlements_and_liens"),
    ],
  },
  {
    num: "06",
    name: "Risk & Deadlines",
    script: "no deadline missed",
    sections: [entity("court_calendar"), entity("deadlines_and_sol")],
  },
  {
    num: "07",
    name: "Documents",
    script: "every page, at hand",
    sections: [
      { to: "/files", label: "Files" },
      { to: "/import", label: "Import" },
    ],
  },
  {
    num: "08",
    name: "Practice Insight",
    script: "the firm, at a glance",
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
    script: "how the firm is set up",
    sections: [entity("lookups"), { to: "/settings", label: "Settings" }],
    back: true,
  },
];

/** Every section in building order: the order Tab walks them in. */
export const SECTIONS: Section[] = FLOORS.flatMap((f) => f.sections);

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

/** "Ground", "Floor 03", "Back office": what the folder tab's kicker says. */
export function floorKicker(floor: Floor): string {
  if (floor.back) return "Back office";
  return floor.num === "G" ? "Ground" : `Floor ${floor.num}`;
}
