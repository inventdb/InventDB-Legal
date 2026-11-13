/**
 * A module's records read as a docket: one row each, its date set out as a
 * block on the left, the caption in the serif, the record's number and a few
 * details under it, its status stamped on the right and — where the module
 * keeps money — the figure that matters most.
 *
 * When the list is sorted by the date the blocks show, the rows fall under
 * plain headings ("The next seven days", "October 2026"), so the order reads
 * at a glance. Sorted any other way, the docket is one run of rows.
 */
import type { ReactNode } from "react";

import { recordTitle, type EntityConfig, type FieldDef } from "../config/entities";
import type { Record as Rec } from "../types";
import { formatCurrencyPrecise, toNumber } from "../utils/format";
import { Badge } from "./ui";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const empty = (v: unknown) => v == null || v === "";

/** A record's date as a local calendar day, or null. */
export function dayOf(value: unknown): Date | null {
  if (empty(value)) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days from today to `d`: negative in the past. */
export function daysFromToday(d: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

const monthLabel = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** Headings for a docket read forwards in time (deadlines, hearings). */
function aheadGroup(d: Date | null, settled: boolean): string {
  if (!d) return "No date set";
  const n = daysFromToday(d);
  if (n < 0) return settled ? "Past" : "Overdue";
  if (n === 0) return "Today";
  if (n <= 7) return "The next seven days";
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "Later this month";
  if (n <= 120) return monthLabel(d);
  return "Further out";
}

/** Headings for a docket read backwards in time (entries, receipts). */
function pastGroup(d: Date | null): string {
  if (!d) return "Undated";
  const n = daysFromToday(d);
  if (n > 0) return "Coming up";
  if (n === 0) return "Today";
  if (n >= -7) return "The last seven days";
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "Earlier this month";
  return monthLabel(d);
}

/** The date a module's docket is read by: what it is sorted by, else its usual order. */
export function docketDateField(config: EntityConfig, sortField: string): FieldDef | null {
  const isDate = (f: FieldDef | undefined) => (f && f.type === "date" ? f : undefined);
  return (
    isDate(config.fields.find((f) => f.name === sortField)) ??
    isDate(config.fields.find((f) => f.name === config.defaultSort?.field)) ??
    config.fields.find((f) => f.type === "date" && f.table) ??
    null
  );
}

/** A status that means the thing is finished, so a past date is no longer late. */
const SETTLED = /done|complete|closed|paid|met|filed|held|cancel|withdrawn|resolved|disbursed/i;

export function DateBlock({ value, flagLate = false }: { value: unknown; flagLate?: boolean }) {
  const d = dayOf(value);
  if (!d) {
    return (
      <span className="ch-date none">
        <span className="d">—</span>
        <span className="m">NO DATE</span>
      </span>
    );
  }
  const n = daysFromToday(d);
  const cls = n === 0 ? " today" : flagLate && n < 0 ? " over" : "";
  const yr = d.getFullYear() !== new Date().getFullYear() ? ` ’${String(d.getFullYear()).slice(2)}` : "";
  return (
    <span className={`ch-date${cls}`} title={d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}>
      <span className="d">{d.getDate()}</span>
      <span className="m">
        {MONTHS[d.getMonth()]}
        {yr}
      </span>
    </span>
  );
}

export function Docket({
  config,
  items,
  sort,
  metaFields,
  renderCell,
  textOf = (record, field) => String(record[field.name] ?? ""),
  onPick,
  label,
  footer,
}: {
  config: EntityConfig;
  items: Rec[];
  sort: { field: string; dir: "asc" | "desc" };
  metaFields: FieldDef[];
  renderCell: (record: Rec, field: FieldDef) => ReactNode;
  /** What a detail reads as, so two details that say the same thing show once. */
  textOf?: (record: Rec, field: FieldDef) => string;
  onPick: (record: Rec) => void;
  label: string;
  footer?: ReactNode;
}) {
  const dateField = docketDateField(config, sort.field);
  const grouped = dateField != null && dateField.name === sort.field;
  const badges = config.fields.filter((f) => f.badge);
  // Client money is the figure a docket of matters is read for; elsewhere the
  // module's first amount column.
  const figure =
    config.fields.find((f) => f.name === "trust_balance") ??
    config.fields.find((f) => f.type === "currency" && f.table) ??
    null;
  const meta = metaFields.filter((f) => f !== dateField);

  let last = "";
  const rows: ReactNode[] = [];
  items.forEach((record, idx) => {
    const d = dateField ? dayOf(record[dateField.name]) : null;
    const settled = badges.some((f) => SETTLED.test(String(record[f.name] ?? "")));
    if (grouped) {
      const g = sort.dir === "asc" ? aheadGroup(d, settled) : pastGroup(d);
      if (g !== last) {
        last = g;
        rows.push(
          <div key={`g-${idx}`} className="ch-docket-group" role="presentation">
            <h3>{g}</h3>
          </div>
        );
      }
    }
    const number = config.hideKeyColumn ? "" : String(record[config.key] ?? "");
    const amount = figure ? toNumber(record[figure.name]) : null;
    rows.push(
      <button
        key={String(record._id ?? idx)}
        type="button"
        className={`ch-drow${figure ? " has-figure" : ""}`}
        onClick={() => onPick(record)}
      >
        {dateField ? (
          <DateBlock value={record[dateField.name]} flagLate={sort.dir === "asc" && !settled} />
        ) : (
          <span className="ch-date code">
            <span className="d">{number.slice(0, 6) || "—"}</span>
          </span>
        )}
        <span className="ch-cap">
          <span className="t">{recordTitle(config, record)}</span>
          <span className="mt">
            {number && <span className="k">{number}</span>}
            {(() => {
              const said = new Set<string>();
              return meta.map((f) => {
                if (empty(record[f.name])) return null;
                const text = textOf(record, f);
                if (said.has(text)) return null;
                said.add(text);
                return (
                  <span key={f.name} title={f.label}>
                    {renderCell(record, f)}
                  </span>
                );
              });
            })()}
          </span>
        </span>
        <span className="ch-tags">
          {badges.map((f) => (empty(record[f.name]) ? null : <Badge key={f.name} value={record[f.name]} />))}
        </span>
        {figure && (
          <span className={`ch-amt${figure.name === "trust_balance" && amount ? " trust" : ""}`}>
            {amount == null ? "—" : formatCurrencyPrecise(amount)}
            <small>{figure.name === "trust_balance" ? "in trust" : figure.label.toLowerCase()}</small>
          </span>
        )}
      </button>
    );
  });

  return (
    <section className="ch-docket" aria-label={label}>
      {rows}
      {footer && <div className="ch-docket-foot">{footer}</div>}
    </section>
  );
}
