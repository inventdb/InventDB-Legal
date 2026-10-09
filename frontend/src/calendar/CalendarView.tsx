/**
 * A module's records as a calendar — the court calendar's other view.
 *
 * Two layouts of the same month, chosen by the width there is:
 *   - a desktop gets the month: seven columns, a few events a day, and the
 *     rest of a busy day one click away;
 *   - a phone gets the agenda: only the days that have something, each event
 *     on its own line with the time, what it is, the matter and the place.
 *
 * Nothing else is on screen: the month, the way to the next one, and the
 * events. Clicking an event opens it in the drill-down panel, read-only, like
 * a row of the table; a day's date (or its "+N more") lists the whole day
 * there. The page's own search still applies, so "deposition" or a matter
 * number narrows the calendar the same way it narrows the table.
 */
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { errorMessage } from "../api/client";
import { useList } from "../api/hooks";
import type { CalendarSpec, EntityConfig } from "../config/entities";
import { Alert } from "../components/ui";
import { useOptionalDrill } from "../drill/DrillContext";
import type { Record as Rec } from "../types";

/** Events shown in a day of the month before the rest fold into "+N more". */
const PER_DAY = 3;
/** Below this width the month becomes an agenda. */
const AGENDA_QUERY = "(max-width: 720px)";

// ---- dates, as plain YYYY-MM-DD strings — no time zone can shift a day -------

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** `YYYY-MM` → the first of that month, or null. */
export function parseMonth(value: string | null | undefined): { y: number; m: number } | null {
  const hit = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!hit) return null;
  const m = Number(hit[2]) - 1;
  return m >= 0 && m < 12 ? { y: Number(hit[1]), m } : null;
}

export const monthKey = ({ y, m }: { y: number; m: number }) => `${y}-${pad(m + 1)}`;

function addMonths({ y, m }: { y: number; m: number }, delta: number) {
  const t = y * 12 + m + delta;
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
}

function today(): string {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Every day the month's grid shows: whole weeks, Sunday first. */
function gridDays({ y, m }: { y: number; m: number }): string[] {
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const last = new Date(y, m + 1, 0);
  const end = new Date(y, m + 1, 0 + (6 - last.getDay()));
  const out: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(ymd(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return out;
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const n = new Date(y, m - 1, d + 1);
  return ymd(n.getFullYear(), n.getMonth(), n.getDate());
}

const asDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const longDay = (day: string) =>
  asDate(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const monthTitle = ({ y, m }: { y: number; m: number }) =>
  new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "08:30" → "8:30 AM", and the compact "8:30a" a month chip has room for. */
function clock(time: unknown): { long: string; short: string } | null {
  const hit = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ""));
  if (!hit) return null;
  const h = Number(hit[1]);
  const mm = hit[2];
  const h12 = h % 12 || 12;
  const ap = h < 12 ? "AM" : "PM";
  return {
    long: `${h12}:${mm} ${ap}`,
    short: `${h12}${mm === "00" ? "" : `:${mm}`}${ap === "AM" ? "a" : "p"}`,
  };
}

const truthy = (v: unknown) => v === true || v === "true" || v === "Yes" || v === 1;

function useMedia(query: string): boolean {
  const get = () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

interface CalEvent {
  rec: Rec;
  day: string;
  time: ReturnType<typeof clock>;
  title: string;
  subtitle: string;
  place: string;
  tone: "yes" | "no" | null;
}

function toEvent(rec: Rec, spec: CalendarSpec): CalEvent | null {
  const day = String(rec[spec.date] ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const text = (f?: string) => (f && rec[f] != null ? String(rec[f]).trim() : "");
  return {
    rec,
    day,
    time: clock(spec.time ? rec[spec.time] : null),
    title: text(spec.title) || "Event",
    subtitle: text(spec.subtitle),
    place: (spec.place ?? []).map((f) => text(f)).filter(Boolean).join(" · "),
    tone: spec.tone ? (truthy(rec[spec.tone.field]) ? "yes" : "no") : null,
  };
}

export function CalendarView({
  config,
  month,
  onMonth,
  q,
  onCount,
}: {
  config: EntityConfig;
  month: { y: number; m: number };
  onMonth: (next: { y: number; m: number }) => void;
  /** The page's search, applied to the calendar as it is to the table. */
  q?: string;
  /** How many events the month holds, for the page's count. */
  onCount?: (n: number | null) => void;
}) {
  const spec = config.calendar!;
  const drill = useOptionalDrill();
  const agenda = useMedia(AGENDA_QUERY);
  const days = useMemo(() => gridDays(month), [month]);
  const first = ymd(month.y, month.m, 1);
  const last = ymd(month.y, month.m, new Date(month.y, month.m + 1, 0).getDate());
  const now = today();

  // The whole grid in one request — a busy month holds a couple of hundred.
  const list = useList(
    config.name,
    {
      [`${spec.date}__gte`]: days[0],
      [`${spec.date}__lt`]: nextDay(days[days.length - 1]),
      q: q || undefined,
      order_by: spec.date,
      order_dir: "asc",
      limit: 2000,
    },
    { placeholderData: keepPreviousData }
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const rec of list.data?.items ?? []) {
      const ev = toEvent(rec, spec);
      if (!ev) continue;
      const list = map.get(ev.day);
      if (list) list.push(ev);
      else map.set(ev.day, [ev]);
    }
    // Within a day, by time; an event with no time leads.
    for (const evs of map.values()) evs.sort((a, b) => (a.time ? String(a.rec[spec.time!]) : "").localeCompare(b.time ? String(b.rec[spec.time!]) : ""));
    return map;
  }, [list.data, spec]);

  const inMonth = (day: string) => day >= first && day <= last;
  const monthCount = useMemo(
    () => [...byDay.entries()].filter(([d]) => inMonth(d)).reduce((n, [, evs]) => n + evs.length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byDay, first, last]
  );
  useEffect(() => {
    onCount?.(list.isLoading ? null : monthCount);
  }, [monthCount, list.isLoading, onCount]);

  const openEvent = (ev: CalEvent) => {
    if (ev.rec._id == null) return;
    drill?.open({ kind: "record", entity: config.name, id: String(ev.rec._id) });
  };
  const openDay = (day: string) =>
    drill?.open({
      kind: "list",
      entity: config.name,
      title: longDay(day),
      subtitle: config.labelPlural,
      filters: { [spec.date]: day },
      q: q || undefined,
      sort: spec.time ? { field: spec.time, dir: "asc" } : undefined,
    });

  const describe = (ev: CalEvent) =>
    [ev.time?.long, ev.title, ev.subtitle && `— ${ev.subtitle}`, ev.place && `(${ev.place})`].filter(Boolean).join(" ");

  return (
    <section className={`cal${list.isFetching && !list.isLoading ? " is-loading" : ""}`} aria-label={`${config.labelPlural} calendar`}>
      <header className="cal-head">
        <div className="cal-nav">
          <button type="button" className="btn-icon" aria-label="Previous month" onClick={() => onMonth(addMonths(month, -1))}>
            <ChevronLeft size={18} />
          </button>
          <h3 className="cal-title" aria-live="polite">
            {monthTitle(month)}
          </h3>
          <button type="button" className="btn-icon" aria-label="Next month" onClick={() => onMonth(addMonths(month, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          type="button"
          className="btn btn-sm cal-today"
          onClick={() => {
            const d = new Date();
            onMonth({ y: d.getFullYear(), m: d.getMonth() });
          }}
        >
          Today
        </button>
        {spec.tone && !agenda && (
          <p className="cal-legend" aria-hidden>
            <span className="cal-dot tone-yes" /> {spec.tone.yes}
            <span className="cal-dot tone-no" /> {spec.tone.no}
          </p>
        )}
      </header>

      {list.isError && <Alert kind="error">{errorMessage(list.error)}</Alert>}

      {agenda ? (
        <Agenda
          days={days.filter(inMonth)}
          byDay={byDay}
          now={now}
          loading={list.isLoading}
          emptyText={q ? `Nothing matches “${q}” in ${monthTitle(month)}.` : `Nothing on the calendar in ${monthTitle(month)}.`}
          onOpen={openEvent}
          describe={describe}
        />
      ) : (
        <div className="cal-month" role="grid" aria-label={monthTitle(month)} aria-busy={list.isLoading}>
          <div className="cal-row cal-weekdays" role="row">
            {WEEKDAYS.map((w) => (
              <div key={w} role="columnheader" className="cal-weekday">
                {w}
              </div>
            ))}
          </div>
          {Array.from({ length: days.length / 7 }, (_, w) => (
            <div key={w} className="cal-row" role="row">
              {days.slice(w * 7, w * 7 + 7).map((day) => {
                const evs = byDay.get(day) ?? [];
                const extra = evs.length - PER_DAY;
                const shown = extra > 0 ? evs.slice(0, PER_DAY - 1) : evs;
                const label = `${longDay(day)}${evs.length ? `, ${evs.length} event${evs.length === 1 ? "" : "s"}` : ""}`;
                return (
                  <div
                    key={day}
                    role="gridcell"
                    aria-label={label}
                    className={`cal-day${inMonth(day) ? "" : " is-outside"}${day === now ? " is-today" : ""}`}
                  >
                    {evs.length ? (
                      <button type="button" className="cal-date" title={`All of ${longDay(day)}`} onClick={() => openDay(day)}>
                        {Number(day.slice(8))}
                      </button>
                    ) : (
                      <span className="cal-date">{Number(day.slice(8))}</span>
                    )}
                    {shown.map((ev) => (
                      <button
                        key={String(ev.rec._id)}
                        type="button"
                        className={`cal-chip${ev.tone ? ` tone-${ev.tone}` : ""}`}
                        title={describe(ev)}
                        aria-label={describe(ev)}
                        onClick={() => openEvent(ev)}
                      >
                        {ev.time && <span className="cal-chip-time">{ev.time.short}</span>}
                        <span className="cal-chip-title">{ev.title}</span>
                      </button>
                    ))}
                    {extra > 0 && (
                      <button type="button" className="cal-more" onClick={() => openDay(day)}>
                        +{extra + 1} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Agenda({
  days,
  byDay,
  now,
  loading,
  emptyText,
  onOpen,
  describe,
}: {
  days: string[];
  byDay: Map<string, CalEvent[]>;
  now: string;
  loading: boolean;
  emptyText: string;
  onOpen: (ev: CalEvent) => void;
  describe: (ev: CalEvent) => string;
}) {
  const busy = days.filter((d) => byDay.has(d));
  if (loading) return <p className="cal-empty">Loading…</p>;
  if (!busy.length) return <p className="cal-empty">{emptyText}</p>;
  return (
    <ol className="cal-agenda">
      {busy.map((day) => {
        const d = asDate(day);
        return (
          <li key={day} className={`cal-agenda-day${day === now ? " is-today" : ""}`}>
            <h4 className="cal-agenda-date">
              <span className="cal-agenda-wd">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className="cal-agenda-num">{d.getDate()}</span>
              <span className="cal-agenda-mo">{d.toLocaleDateString("en-US", { month: "short" })}</span>
              {day === now && <span className="cal-agenda-today">Today</span>}
            </h4>
            <ul>
              {byDay.get(day)!.map((ev) => (
                <li key={String(ev.rec._id)}>
                  <button
                    type="button"
                    className={`cal-agenda-event${ev.tone ? ` tone-${ev.tone}` : ""}`}
                    aria-label={describe(ev)}
                    onClick={() => onOpen(ev)}
                  >
                    <span className="cal-agenda-time">{ev.time?.long ?? "All day"}</span>
                    <span className="cal-agenda-body">
                      <span className="cal-agenda-title">{ev.title}</span>
                      {ev.subtitle && <span className="cal-agenda-sub">{ev.subtitle}</span>}
                      {ev.place && <span className="cal-agenda-place">{ev.place}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
