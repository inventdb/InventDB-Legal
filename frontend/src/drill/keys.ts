/**
 * The firm's record numbers, read off a page.
 *
 * Every module numbers its records with a prefix of its own — MT-2599 is a
 * matter, INV-2026-1562 an invoice, LD-3009 a prospect — so a number seen
 * anywhere names exactly one record. That lets a table with no query behind it
 * (one the assistant wrote in its answer, a rendered report) still open the
 * record a row is about, in the same drill-down panel as every other grid.
 */
import { ENTITY_BY_NAME } from "../config/entities";
import type { DrillFrame } from "./DrillContext";

const PREFIX: Record<string, string> = {
  MT: "matters",
  CL: "clients",
  TK: "timekeepers",
  TE: "time_entries",
  CO: "costs_and_disbursements",
  INV: "invoices",
  PY: "payments_and_receipts",
  TR: "trust_ledger_cta",
  EV: "court_calendar",
  DL: "deadlines_and_sol",
  LD: "intake_and_leads",
  ST: "settlements_and_liens",
};

/** A cell that starts with a record number: "MT-2599", "INV-2026-1562 (paid)". */
const LEADING = new RegExp(`^(${Object.keys(PREFIX).join("|")})-(\\d[\\d-]*\\d|\\d)(?![\\w-])`);

/** The record a cell's text names, as a drill-down frame — or null. */
export function recordFrame(text: string | null | undefined): Extract<DrillFrame, { kind: "record" }> | null {
  const bare = String(text ?? "")
    .replace(/[*`_]/g, "")
    .trim();
  const m = bare.match(LEADING);
  if (!m) return null;
  const entity = PREFIX[m[1]];
  const cfg = ENTITY_BY_NAME[entity];
  if (!cfg) return null;
  return { kind: "record", entity, match: { field: cfg.key, value: m[0] } };
}

/** The record a row is about: the first of its cells that holds a record number. */
export function rowFrame(cells: (string | null | undefined)[]): Extract<DrillFrame, { kind: "record" }> | null {
  for (const c of cells) {
    const f = recordFrame(c);
    if (f) return f;
  }
  return null;
}
