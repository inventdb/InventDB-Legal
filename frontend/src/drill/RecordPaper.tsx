/**
 * One record, set out as a page of pleading paper: a numbered margin, the
 * caption block a court filing opens with, and the record's particulars
 * beneath it.
 *
 * It is the right-hand page of a module's casebook (the index of records sits
 * to its left). It reads the record the same way the drill-down panel does —
 * same query, so an edit made in either refreshes both — and every link out of
 * it (a client, a matter's time entries, a file) opens in that panel, one level
 * deeper, without losing your place in the index.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

import { api, errorMessage } from "../api/client";
import { ENTITY_BY_NAME, recordTitle, type EntityConfig, type FieldDef } from "../config/entities";
import { floorOf } from "../config/floors";
import type { Record as Rec } from "../types";
import { formatCell } from "../utils/format";
import { Badge, Spinner } from "../components/ui";
import { useReferences } from "../components/references";
import { useDrill } from "./DrillContext";
import { DrillGrid } from "./DrillGrid";
import { DrillFiles } from "./DrillFiles";
import { childHeading, childrenOf, fieldText, parentsOf, relationFor } from "./relations";

/** The margin's line numbers: enough to run past any record's first screen. */
const MARGIN = Array.from({ length: 60 }, (_, i) => i + 1).join("\n");

/** "Pineda v. Bright Path" → the two parties; anything else → null. */
function adverseParties(title: string): [string, string] | null {
  const m = title.match(/^(.+?)\s+(?:v\.|vs\.?|versus)\s+(.+)$/i);
  return m ? [m[1], m[2]] : null;
}

const empty = (v: unknown) => v == null || v === "";

/** Fields grouped the way a reader looks for them: what it is, when, how much. */
function groupFields(cfg: EntityConfig): { title: string; fields: FieldDef[] }[] {
  const when = cfg.fields.filter((f) => f.type === "date");
  const figures = cfg.fields.filter(
    (f) => f.type === "currency" || f.type === "number" || f.type === "boolean"
  );
  const what = cfg.fields.filter((f) => !when.includes(f) && !figures.includes(f));
  return [
    { title: "Particulars", fields: what },
    { title: "Dates", fields: when },
    { title: "Figures", fields: figures },
  ].filter((g) => g.fields.length > 0);
}

export function RecordPaper({
  entity,
  id,
  onEdit,
  onDelete,
  onBack,
}: {
  entity: string;
  id: string;
  onEdit: (record: Rec) => void;
  onDelete: (record: Rec) => void;
  /** The phone's way back to the index. */
  onBack: () => void;
}) {
  const cfg = ENTITY_BY_NAME[entity] as EntityConfig | undefined;
  const drill = useDrill();
  const [tab, setTab] = useState<"particulars" | "related" | "files">("particulars");

  const rec = useQuery({
    queryKey: ["drill", "record", entity, id],
    queryFn: async (): Promise<Rec | null> => {
      const { data } = await api.get<Rec>(`/${entity}/${encodeURIComponent(id)}`);
      return data && data._id != null ? data : null;
    },
  });
  const record = rec.data ?? null;

  const parents = useMemo(() => (cfg ? parentsOf(cfg.name) : []), [cfg]);
  const children = useMemo(() => (cfg ? childrenOf(cfg.name) : []), [cfg]);
  const groups = useMemo(() => (cfg ? groupFields(cfg) : []), [cfg]);
  const { labels } = useReferences(
    parents.filter((r) => r.toField === ENTITY_BY_NAME[r.to]?.key).map((r) => r.to)
  );

  const back = (
    <button type="button" className="cb-back" onClick={onBack}>
      <ArrowLeft size={16} aria-hidden />
      <span>{cfg?.labelPlural ?? "Back"}</span>
    </button>
  );

  if (!cfg) return null;
  if (rec.isLoading) {
    return (
      <article className="cb-paper" aria-busy="true">
        <div className="cb-margin" aria-hidden>
          {MARGIN}
        </div>
        <div className="cb-pbody">
          {back}
          <Spinner />
        </div>
      </article>
    );
  }
  if (rec.isError || !record) {
    return (
      <article className="cb-paper">
        <div className="cb-margin" aria-hidden>
          {MARGIN}
        </div>
        <div className="cb-pbody">
          {back}
          <div className="cb-blank" role="alert">
            <h2>Not on file</h2>
            <p>
              {rec.isError && axios.isAxiosError(rec.error) && rec.error.response?.status !== 404
                ? errorMessage(rec.error)
                : `This ${cfg.label.toLowerCase()} isn't available — it may have been deleted, or it isn't visible to you.`}
            </p>
          </div>
        </div>
      </article>
    );
  }

  const title = recordTitle(cfg, record);
  const number = empty(record[cfg.key]) ? "" : String(record[cfg.key]);
  const parties = adverseParties(title);
  const status = cfg.fields.find((f) => f.badge && !empty(record[f.name]));
  const court = !empty(record.court) ? String(record.court) : `${floorOf(`/${cfg.name}`).name} · ${cfg.labelPlural}`;
  // The line under the caption's number: what kind of record this is — a
  // matter's practice area, an invoice's type — or the module's own name.
  const kind =
    cfg.fields.find((f) => f.type === "select" && !f.badge && f.table && !empty(record[f.name])) ??
    null;
  // Under the title: the first thing the record points at, by name (a
  // matter's client), or failing that the first plain detail it carries.
  const named = parents
    .map((r) => labels[r.to]?.[String(record[r.field])])
    .find((label) => label && label !== title);
  const detail = cfg.fields.find(
    (f) =>
      f.table &&
      (f.type === "text" || f.type === "email" || f.type === "tel") &&
      !f.ref &&
      !cfg.titleFields.includes(f.name) &&
      f.name !== cfg.key &&
      !empty(record[f.name])
  );
  const sub = named ?? (detail ? String(record[detail.name]) : "");

  const relatedRels = children.filter((rel) => !empty(record[rel.toField]));
  const known = new Set(cfg.fields.map((f) => f.name));
  const extras = Object.keys(record).filter((k) => !k.startsWith("_") && !known.has(k) && k !== cfg.key);

  const openParent = (field: FieldDef, value: unknown) => {
    const rel = relationFor(cfg.name, field.name);
    if (rel) drill.push({ kind: "record", entity: rel.to, match: { field: rel.toField, value } });
  };

  const value = (f: FieldDef) => {
    const v = record[f.name];
    if (empty(v)) return <span className="cb-faint">—</span>;
    const rel = relationFor(cfg.name, f.name);
    if (rel) {
      const name = labels[rel.to]?.[String(v)];
      return (
        <button type="button" className="cb-link" onClick={() => openParent(f, v)}>
          {String(v)}
          {name && name !== String(v) && <span className="sub"> · {name}</span>}
          <ChevronRight size={12} aria-hidden />
        </button>
      );
    }
    if (f.badge) return <Badge value={v} />;
    return fieldText(f, v);
  };

  const tabs = [
    { id: "particulars" as const, label: "Particulars" },
    { id: "related" as const, label: `Related${relatedRels.length ? ` (${relatedRels.length})` : ""}` },
    { id: "files" as const, label: "Files" },
  ];

  return (
    <article className="cb-paper" aria-label={`${cfg.label} ${number || title}`}>
      <div className="cb-margin" aria-hidden>
        {MARGIN}
      </div>
      <div className="cb-pbody">
        {back}
        <div className="cb-court">{court}</div>
        <div className="cb-caption">
          <div className="cb-parties">
            {parties ? (
              <>
                <div className="cb-party">{parties[0]},</div>
                <div className="cb-role">Plaintiff,</div>
                <div style={{ margin: "6px 0" }}>v.</div>
                <div className="cb-party">{parties[1]},</div>
                <div className="cb-role">Defendant.</div>
              </>
            ) : (
              <>
                <div className="cb-role">In the matter of</div>
                <h2 className="cb-party">{title}</h2>
                {sub && <div className="cb-role">{sub}</div>}
              </>
            )}
          </div>
          <div className="cb-paren" aria-hidden>
            {")\n)\n)\n)\n)\n)"}
          </div>
          <div className="cb-caseno">
            {number && (
              <>
                <div className="l">{cfg.label} no.</div>
                <div className="v">{number}</div>
              </>
            )}
            {!empty(record.case_number) && cfg.name === "matters" && (
              <>
                <div className="l" style={{ marginTop: 8 }}>
                  Court case no.
                </div>
                <div className="v">{String(record.case_number)}</div>
              </>
            )}
            <div className="t">{kind ? String(record[kind.name]) : cfg.label}</div>
            {status && <Badge value={record[status.name]} />}
          </div>
        </div>
        {/* An adverse caption names the parties, not the record; the record's
            title is still its heading for anyone navigating by headings. */}
        {parties && <h2 className="sr-only">{title}</h2>}

        <div className="cb-actions">
          <button type="button" className="btn" onClick={() => onEdit(record)}>
            <Pencil size={15} aria-hidden /> Edit
          </button>
          <button type="button" className="btn btn-danger" onClick={() => onDelete(record)}>
            <Trash2 size={15} aria-hidden /> Delete
          </button>
        </div>

        <div className="cb-tabs" role="tablist" aria-label="Sections of this record">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="cb-tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "particulars" && (
          <div role="tabpanel" aria-label="Particulars">
            {groups.map((g, gi) => (
              <section key={g.title} aria-label={g.title}>
                <h3 className="cb-h3">
                  <span className="n">{gi + 1}.</span>
                  {g.title}
                </h3>
                <dl className="cb-facts">
                  {g.fields.map((f) => (
                    <div key={f.name} className={`cb-fact${f.full || f.type === "textarea" ? " full" : ""}`}>
                      <dt>{f.label}</dt>
                      <dd>{value(f)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {extras.length > 0 && (
              <section aria-label="Also on file">
                <h3 className="cb-h3">
                  <span className="n">{groups.length + 1}.</span>
                  Also on file
                </h3>
                <dl className="cb-facts">
                  {extras.map((k) => (
                    <div key={k} className="cb-fact">
                      <dt>{k}</dt>
                      <dd>{formatCell(record[k], "text")}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}

        {tab === "related" && (
          <div role="tabpanel" aria-label="Related" className="cb-related">
            {relatedRels.length === 0 && (
              <p className="cb-faint">Nothing else in the books points to this record yet.</p>
            )}
            {relatedRels.map((rel) => {
              const childCfg = ENTITY_BY_NAME[rel.from];
              return (
                <DrillGrid
                  key={`${rel.from}.${rel.field}`}
                  entity={rel.from}
                  title={childHeading(rel, childCfg)}
                  query={{ filters: { [rel.field]: record[rel.toField] } }}
                  pageSize={5}
                  maxColumns={4}
                  emptyText={`No ${childCfg?.labelPlural.toLowerCase() ?? rel.from} for this ${cfg.label.toLowerCase()}.`}
                  onOpen={(row) =>
                    drill.push({ kind: "record", entity: rel.from, id: row._id != null ? String(row._id) : undefined })
                  }
                />
              );
            })}
          </div>
        )}

        {tab === "files" && (
          <div role="tabpanel" aria-label="Files">
            <DrillFiles entity={cfg.name} recordId={String(record._id)} label={cfg.label} />
          </div>
        )}
      </div>
    </article>
  );
}
