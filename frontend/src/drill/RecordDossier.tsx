/**
 * One record, opened as a dossier: a head that says what it is (its number,
 * its title, the court or the module it belongs to, its status), the record's
 * particulars in panels beneath, and — on the right — what it is tied to:
 * client money held for a matter, and the records it points at.
 *
 * It replaces the docket on screen; the back link returns to it. It reads the
 * record the same way the drill-down panel does — same query, so an edit made
 * in either refreshes both — and every link out of it (a client, a matter's
 * time entries, a file) opens in that panel, one level deeper.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

import { api, errorMessage } from "../api/client";
import { ENTITY_BY_NAME, recordTitle, type EntityConfig, type FieldDef } from "../config/entities";
import { floorOf } from "../config/floors";
import type { Record as Rec } from "../types";
import { formatCell, formatCurrencyPrecise, toNumber } from "../utils/format";
import { Badge, Spinner } from "../components/ui";
import { useReferences } from "../components/references";
import { useDrill } from "./DrillContext";
import { DrillGrid } from "./DrillGrid";
import { DrillFiles } from "./DrillFiles";
import { childHeading, childrenOf, fieldText, parentsOf, relationFor } from "./relations";

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

/** Client money held for a matter, against its retainer and the point to top it up. */
function TrustPanel({ record }: { record: Rec }) {
  const balance = toNumber(record.trust_balance) ?? 0;
  const retainer = toNumber(record.retainer_amount) ?? 0;
  const threshold = toNumber(record.replenish_threshold) ?? 0;
  const required = record.trust_required === true || record.trust_required === "true";
  if (!required && !balance) {
    return (
      <section className="ch-panel">
        <header>
          <h3>Trust Ledger (CTA)</h3>
        </header>
        <div className="bd">
          <p className="cb-faint" style={{ margin: 0 }}>
            This matter does not hold client funds in trust.
          </p>
        </div>
      </section>
    );
  }
  const top = Math.max(retainer, balance, 1);
  const low = threshold > 0 && balance < threshold;
  return (
    <section className={`ch-trust${low ? " low" : ""}`} aria-label="Trust balance">
      <div className="ch-overline">Trust Ledger (CTA) · balance</div>
      <div className="v">{formatCurrencyPrecise(balance)}</div>
      <div className="bar" aria-hidden>
        <i style={{ width: `${Math.min(100, (balance / top) * 100)}%` }} />
        {threshold > 0 && <b style={{ left: `${Math.min(100, (threshold / top) * 100)}%` }} />}
      </div>
      <div className="s">
        <span>
          Replenish at <span className="k">{formatCurrencyPrecise(threshold)}</span>
        </span>
        <span>
          Retainer <span className="k">{formatCurrencyPrecise(retainer)}</span>
        </span>
      </div>
      {low && (
        <p className="ch-trust-note">
          <b>Below the replenish threshold.</b> Ask the client to top up the retainer.
        </p>
      )}
    </section>
  );
}

export function RecordDossier({
  entity,
  id,
  onEdit,
  onDelete,
  onBack,
}: {
  entity: string;
  id: string;
  /** Left out for a module this person can only read. */
  onEdit?: (record: Rec) => void;
  onDelete?: (record: Rec) => void;
  /** Back to the docket. */
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
    <div className="ch-crumbs">
      <button type="button" className="ch-backlink" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden />
        <span>{cfg?.labelPlural ?? "Back"}</span>
      </button>
    </div>
  );

  if (!cfg) return null;
  if (rec.isLoading) {
    return (
      <article className="ch-dossier" aria-busy="true">
        {back}
        <Spinner />
      </article>
    );
  }
  if (rec.isError || !record) {
    return (
      <article className="ch-dossier">
        {back}
        <div className="ch-empty" role="alert">
          <h2>Not on file</h2>
          <p>
            {rec.isError && axios.isAxiosError(rec.error) && rec.error.response?.status !== 404
              ? errorMessage(rec.error)
              : `This ${cfg.label.toLowerCase()} isn't available — it may have been deleted, or it isn't visible to you.`}
          </p>
        </div>
      </article>
    );
  }

  const title = recordTitle(cfg, record);
  const number = empty(record[cfg.key]) ? "" : String(record[cfg.key]);
  const isMatter = cfg.name === "matters";
  const badges = cfg.fields.filter((f) => f.badge && !empty(record[f.name]));
  // The line under the title: a matter's court and case number, or which
  // part of the firm the record belongs to.
  const court = !empty(record.court) ? String(record.court) : "";
  const kind =
    cfg.fields.find((f) => f.type === "select" && !f.badge && f.table && !empty(record[f.name])) ?? null;
  const named = parents
    .map((r) => labels[r.to]?.[String(record[r.field])])
    .find((label) => label && label !== title);

  const relatedRels = children.filter((rel) => !empty(record[rel.toField]));
  const linked = cfg.fields.filter((f) => relationFor(cfg.name, f.name) && !empty(record[f.name]));
  const known = new Set(cfg.fields.map((f) => f.name));
  const extras = Object.keys(record).filter((k) => !k.startsWith("_") && !known.has(k) && k !== cfg.key);

  const openParent = (field: FieldDef, value: unknown) => {
    const rel = relationFor(cfg.name, field.name);
    if (rel) drill.push({ kind: "record", entity: rel.to, match: { field: rel.toField, value } });
  };

  const refButton = (f: FieldDef, v: unknown) => {
    const rel = relationFor(cfg.name, f.name);
    const name = rel ? labels[rel.to]?.[String(v)] : undefined;
    return (
      <button type="button" className="ch-link" onClick={() => openParent(f, v)}>
        {String(v)}
        {name && name !== String(v) && <span className="sub"> · {name}</span>}
        <ChevronRight size={12} aria-hidden />
      </button>
    );
  };

  const value = (f: FieldDef) => {
    const v = record[f.name];
    if (empty(v)) return <span className="cb-faint">—</span>;
    if (relationFor(cfg.name, f.name)) return refButton(f, v);
    if (f.badge) return <Badge value={v} />;
    return fieldText(f, v);
  };

  const tabs = [
    { id: "particulars" as const, label: "Particulars" },
    { id: "related" as const, label: `Related${relatedRels.length ? ` (${relatedRels.length})` : ""}` },
    { id: "files" as const, label: "Files" },
  ];

  return (
    <article className="ch-dossier" aria-label={`${cfg.label} ${number || title}`}>
      {back}
      <section className="ch-dossier-head">
        <div className="top">
          <div>
            <div className="ch-overline ch-number">
              {cfg.label}
              {number && <> · {number}</>}
            </div>
            <h2>{title}</h2>
            <div className="line">
              {court ? (
                <>
                  {court}
                  {!empty(record.case_number) && (
                    <>
                      {" · "}
                      <span className="k">{String(record.case_number)}</span>
                    </>
                  )}
                  {!empty(record.judicial_officer) && <> · {String(record.judicial_officer)}</>}
                  {!empty(record.department) && (
                    <>, {/^dept/i.test(String(record.department)) ? "" : "Dept. "}{String(record.department)}</>
                  )}
                </>
              ) : isMatter ? (
                <>Not yet filed{named ? ` · ${named}` : ""}</>
              ) : (
                <>
                  {floorOf(`/${cfg.name}`).name} · {cfg.labelPlural}
                  {named ? ` · ${named}` : ""}
                </>
              )}
            </div>
            <div className="tags">
              {badges.map((f) => (
                <Badge key={f.name} value={record[f.name]} />
              ))}
              {kind && <span className="ch-tag neutral">{String(record[kind.name])}</span>}
              {isMatter && !empty(record.stage) && <span className="ch-tag info">{String(record.stage)}</span>}
              {isMatter && <span className="ch-tag privileged">Privileged</span>}
            </div>
          </div>
          <div className="act">
            {onEdit && <button type="button" className="btn" onClick={() => onEdit(record)}>
              <Pencil size={15} aria-hidden /> Edit
            </button>}
            {onDelete && <button type="button" className="btn btn-danger" onClick={() => onDelete(record)}>
              <Trash2 size={15} aria-hidden /> Delete
            </button>}
          </div>
        </div>
      </section>

      <div className="ch-tabs" role="tablist" aria-label="Sections of this record">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="ch-tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ch-dossier-body">
        <div className="ch-col">
          {tab === "particulars" && (
            <div role="tabpanel" aria-label="Particulars" className="ch-col">
              {groups.map((g) => (
                <section key={g.title} className="ch-panel" aria-label={g.title}>
                  <header>
                    <h3>{g.title}</h3>
                  </header>
                  <dl className="ch-facts">
                    {g.fields.map((f) => (
                      <div key={f.name} className={f.full || f.type === "textarea" ? "full" : undefined}>
                        <dt>{f.label}</dt>
                        <dd>{value(f)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              {extras.length > 0 && (
                <section className="ch-panel" aria-label="Also on file">
                  <header>
                    <h3>Also on file</h3>
                  </header>
                  <dl className="ch-facts">
                    {extras.map((k) => (
                      <div key={k}>
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
            <div role="tabpanel" aria-label="Related" className="ch-col ch-related">
              {relatedRels.length === 0 && (
                <p className="cb-faint">Nothing else in the books points to this record yet.</p>
              )}
              {relatedRels.map((rel) => {
                const childCfg = ENTITY_BY_NAME[rel.from];
                return (
                  <section key={`${rel.from}.${rel.field}`} className="ch-panel">
                    <DrillGrid
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
                  </section>
                );
              })}
            </div>
          )}

          {tab === "files" && (
            <div role="tabpanel" aria-label="Files" className="ch-panel ch-files">
              <DrillFiles entity={cfg.name} recordId={String(record._id)} label={cfg.label} />
            </div>
          )}
        </div>

        <aside className="ch-col" aria-label="At a glance">
          {isMatter && <TrustPanel record={record} />}
          {linked.length > 0 && (
            <section className="ch-panel">
              <header>
                <h3>Linked records</h3>
              </header>
              <div className="bd">
                <dl className="ch-kv">
                  {linked.map((f) => (
                    <div key={f.name}>
                      <dt>{f.label}</dt>
                      <dd>{refButton(f, record[f.name])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          )}
          {isMatter && (
            <section className="ch-panel">
              <header>
                <h3>The money</h3>
              </header>
              <div className="bd">
                <dl className="ch-kv">
                  {(["recorded_hours", "recorded_value_at_standard_rates", "costs_advanced", "fees_billed", "collected"] as const).map(
                    (name) => {
                      const f = cfg.fields.find((x) => x.name === name);
                      if (!f) return null;
                      return (
                        <div key={name}>
                          <dt>{f.label}</dt>
                          <dd className="num">{empty(record[name]) ? "—" : formatCell(record[name], f.type)}</dd>
                        </div>
                      );
                    }
                  )}
                </dl>
              </div>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
