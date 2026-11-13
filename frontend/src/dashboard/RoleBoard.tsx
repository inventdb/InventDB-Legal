/**
 * The top of the dashboard: this person's figures, lists and sections.
 *
 * Everything it shows comes from `boards.ts` (which tiles and panels) and the
 * backend (which of those the tier may read). There is no tier logic here.
 *
 * Structure, for styling in chambers.css:
 *
 *   section.ch-board
 *     div.ch-kpis
 *       a.ch-kpi[.is-alert]         > span.ch-kpi-label, span.ch-kpi-value, span.ch-kpi-note
 *     div.ch-panels
 *       section.ch-panel.card       > header.ch-panel-head (h3, a.ch-panel-more)
 *                                   > ul.ch-panel-list > li > button.ch-panel-row
 *                                       (span.ch-panel-main, span.ch-panel-meta)
 *                                   > p.ch-panel-empty
 *     nav.ch-shortcuts              > a.ch-shortcut
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { useDashboardSummary } from "../api/hooks";
import type { AccessMap } from "../config/access";
import { sectionsFor } from "../config/floors";
import { Skeleton } from "../analyze/ui";
import { useDrill } from "../drill/DrillContext";
import { formatCurrency, formatDate, formatNumber } from "../utils/format";
import { BOARDS, PANELS, TILES, type PanelColumn, type PanelKey, type TileDef } from "./boards";

type Row = Record<string, unknown>;
type PanelsPayload = Partial<Record<PanelKey, { entity: string; rows: Row[] }>>;

function pick(obj: unknown, path: string): number | undefined {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "number" ? cur : undefined;
}

function tileText(t: TileDef, v: number): string {
  if (t.format === "money") return formatCurrency(v);
  if (t.format === "hours") return `${formatNumber(Math.round(v * 10) / 10)} h`;
  return formatNumber(v);
}

function cellText(row: Row, col: PanelColumn): string {
  const v = row[col.field];
  if (v == null || v === "") return "";
  if (col.format === "date") return formatDate(v);
  if (col.format === "money") return formatCurrency(v);
  if (col.format === "hours") return `${formatNumber(v)} h`;
  return String(v);
}

export function RoleBoard({ access }: { access: AccessMap }) {
  const board = access.tier ? BOARDS[access.tier] : null;
  const summary = useDashboardSummary();
  const names = board?.panels ?? [];
  const panels = useQuery<PanelsPayload>({
    queryKey: ["dashboard", "panels", names.join(",")],
    enabled: names.length > 0,
    queryFn: async () => {
      const { data } = await api.get<PanelsPayload>("/dashboard/panels", {
        params: { names: names.join(",") },
      });
      return data;
    },
  });
  const drill = useDrill();

  if (!board) return null;

  const tiles = board.tiles
    .map((k) => TILES[k] as TileDef)
    .map((t) => ({ t, v: pick(summary.data, t.path) }))
    // While loading every tile holds its place; once the figures arrive, a tile
    // the backend left out (the tier cannot read it) goes.
    .filter(({ v }) => !summary.data || v !== undefined)
    .filter(({ t }) => access.sections.includes(t.to));

  const shortcuts = sectionsFor(access.sections).filter((s) => s.to !== "/" && s.to !== "/settings");

  return (
    <section className="ch-board" aria-label="At a glance">
      <div className="ch-kpis">
        {tiles.map(({ t, v }) => (
          <Link
            key={t.path}
            to={t.to}
            className={`ch-kpi${t.alertAbove0 && (v ?? 0) > 0 ? " is-alert" : ""}`}
          >
            <span className="ch-kpi-label">{t.label}</span>
            <span className="ch-kpi-value">
              {v === undefined ? <Skeleton h={24} /> : tileText(t, v)}
            </span>
            {t.note && <span className="ch-kpi-note">{t.note}</span>}
          </Link>
        ))}
      </div>

      <div className="ch-panels">
        {names.map((key) => {
          const def = PANELS[key];
          const data = panels.data?.[key];
          if (panels.data && !data) return null; // not readable by this tier
          return (
            <section key={key} className="ch-panel card" aria-label={def.title}>
              <header className="ch-panel-head">
                <h3>{def.title}</h3>
                <Link className="ch-panel-more" to={def.to}>
                  All
                </Link>
              </header>
              {!data ? (
                <Skeleton h={96} />
              ) : data.rows.length === 0 ? (
                <p className="ch-panel-empty">{def.empty}</p>
              ) : (
                <ul className="ch-panel-list">
                  {data.rows.map((row, i) => (
                    <li key={String(row._id ?? i)}>
                      <button
                        type="button"
                        className="ch-panel-row"
                        onClick={() =>
                          row._id != null &&
                          drill.open({ kind: "record", entity: data.entity, id: String(row._id) })
                        }
                      >
                        <span className="ch-panel-main">{String(row[def.main] ?? "—")}</span>
                        <span className="ch-panel-meta">
                          {def.meta
                            .map((c) => cellText(row, c))
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {shortcuts.length > 0 && (
        <nav className="ch-shortcuts" aria-label="Your sections">
          {shortcuts.map((s) => (
            <Link key={s.to} to={s.to} className="ch-shortcut">
              {s.label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
