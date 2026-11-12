import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";

import { useCreate, useDelete, useList, useUpdate } from "../api/hooks";
import { errorMessage } from "../api/client";
import {
  ENTITY_BY_NAME,
  recordTitle,
  type EntityConfig,
  type FieldDef,
} from "../config/entities";
import type { Record as Rec } from "../types";
import { formatCell } from "../utils/format";
import { EntityForm } from "../components/EntityForm";
import { ConfirmDialog, Modal } from "../components/Modal";
import { useReferences } from "../components/references";
import { ScrollX } from "../components/ScrollX";
import { useToast } from "../components/Toast";
import { useDrill } from "../drill/DrillContext";
import { RecordPaper } from "../drill/RecordPaper";
import { Alert, Badge, EmptyState, Spinner } from "../components/ui";
import { ViewSwitcher } from "../views/ViewSwitcher";
import { ViewDesigner, type DesignedView } from "../views/ViewDesigner";
import { ReportFrame } from "../components/ReportFrame";
import { CalendarView, monthKey, parseMonth } from "../calendar/CalendarView";
import {
  useCreateView,
  useDeleteViews,
  useRenderedView,
  useSetDefaultView,
  useUpdateView,
  useViews,
  type SavedView,
} from "../views/api";

/** Rows per page. 50 fills a desktop pane without over-fetching on a phone. */
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZES = [25, 50, 100, 200];

/**
 * How a module is read. The casebook INDEX (records as cards, the chosen one
 * open as a page beside them) is where a module opens; the LEDGER is the table,
 * for scanning and sorting many rows; a module whose records happen on a day
 * can also be read as a CALENDAR. The choice lives in the URL so a reload or a
 * shared link keeps it, and the last choice is remembered per module.
 */
type Layout = "index" | "ledger" | "calendar";
const layoutKey = (entity: string) => `legal.view.${entity}`;

function rememberedLayout(entity: string): Layout | null {
  try {
    const v = localStorage.getItem(layoutKey(entity));
    return v === "index" || v === "ledger" ? v : null;
  } catch {
    return null;
  }
}

/** Money and quantities read down a column, so they align right in figures. */
const isAmount = (f: FieldDef) => f.type === "currency" || (f.type === "number" && !/year|bar_number/i.test(f.name));

/** True on a phone, where the index and the page are two screens. */
const onPhone = () => !!window.matchMedia?.("(max-width: 720px)").matches;

export default function EntityListPage() {
  const { entity = "" } = useParams();
  const config = ENTITY_BY_NAME[entity];
  if (!config) {
    return (
      <div className="content">
        <EmptyState title="Unknown module" message={`No module named "${entity}".`} />
      </div>
    );
  }
  // key ensures state resets when navigating between entities
  return <EntityModule key={config.name} config={config} />;
}

function EntityModule({ config }: { config: EntityConfig }) {
  const toast = useToast();
  const drill = useDrill();
  const [params, setParams] = useSearchParams();
  const [rawSearch, setRawSearch] = useState(() => params.get("q") ?? "");
  const [q, setQ] = useState(() => params.get("q")?.trim() ?? "");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>(
    config.defaultSort ?? { field: config.key, dir: "asc" }
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [deleting, setDeleting] = useState<Rec | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // The index: which record is open on the page beside it — and, on a phone,
  // where the index and the page are two screens, whether the page is showing.
  const [selId, setSelId] = useState<string | null>(null);
  const [showPage, setShowPage] = useState(false);
  // The index can be narrowed by status, when the module has a short list of
  // them. Filtered by the server, like the search, so the count stays true.
  const statusField = useMemo(
    () =>
      config.fields.find((f) => f.badge && f.options && f.options.length > 1 && f.options.length <= 8) ??
      null,
    [config]
  );
  const [status, setStatus] = useState<string | null>(null);

  // --- Saved views -------------------------------------------------------
  // `null` means the unfiltered "All <module>" list. A view is only ever the
  // *source* of the search and sort below — once applied it stops being
  // authoritative, so editing the search box leaves the view selected rather
  // than silently rewriting what was saved.
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [designing, setDesigning] = useState(false);
  /** The saved view the designer is amending. null = designing a new one. */
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  const qc = useQueryClient();
  const views = useViews(config.name);
  const createView = useCreateView(config.name);
  const updateView = useUpdateView(config.name);
  const deleteViews = useDeleteViews(config.name);
  const setDefaultView = useSetDefaultView(config.name);

  // A custom view replaces the grid with a layout the designer built, so the
  // page has to know which surface it is drawing before it draws either.
  const activeView = (views.data ?? []).find((v) => v.id === activeViewId) ?? null;
  const customView = activeView?.mode === "custom" ? activeView : null;

  // Index, ledger or calendar — and which month — live in the URL, so a
  // reload or a shared link keeps them.
  const asked = params.get("view");
  const layout: Layout =
    asked === "calendar" && config.calendar
      ? "calendar"
      : asked === "ledger" || asked === "index"
      ? asked
      : rememberedLayout(config.name) ?? "index";
  const calendarOn = layout === "calendar";
  const indexOn = layout === "index" && !customView;
  const calMonth = useMemo(() => {
    const now = new Date();
    return parseMonth(params.get("month")) ?? { y: now.getFullYear(), m: now.getMonth() };
  }, [params]);
  const [calCount, setCalCount] = useState<number | null>(null);
  const setLayout = (to: Layout) => {
    if (to !== "calendar") {
      try {
        localStorage.setItem(layoutKey(config.name), to);
      } catch {
        /* a private window: the URL still carries the choice */
      }
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("view", to);
        if (to !== "calendar") next.delete("month");
        return next;
      },
      { replace: true }
    );
  };
  const setCalMonth = (m: { y: number; m: number }) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("month", monthKey(m));
        return next;
      },
      { replace: true }
    );

  function applyView(view: SavedView) {
    // A designed view draws its own layout, so it is a table-side view.
    if (view.mode === "custom" && calendarOn) setLayout("index");
    setDesigning(false);
    setActiveViewId(view.id);
    setRawSearch(view.search);
    setQ(view.search.trim());
    if (view.sort) setSort({ field: view.sort.col, dir: view.sort.dir });
    setPage(0);
  }

  function applyAllView() {
    setDesigning(false);
    setActiveViewId(null);
    setRawSearch("");
    setQ("");
    setSort(config.defaultSort ?? { field: config.key, dir: "asc" });
    setPage(0);
  }

  // Open the pinned default once, on first load of this module. A `?q=` in the
  // URL wins: someone following a deep link asked for that specific list, and
  // replacing it with a saved view would discard the thing they clicked.
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (defaultApplied.current || views.isLoading) return;
    defaultApplied.current = true;
    if (params.get("q")) return;
    const pinned = (views.data ?? []).find((v) => v.is_default);
    if (pinned) applyView(pinned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.isLoading, views.data]);

  async function saveDesignedView(designed: DesignedView, name: string) {
    try {
      if (editingView) {
        // The template is edited in place upstream, so the view keeps its id,
        // its default flag and its place in the list — a change to a view, not
        // a second view that looks like it.
        await updateView.mutateAsync({
          id: editingView.id,
          patch: {
            name,
            template_id: designed.template_id,
            base_sql: designed.base_sql ?? undefined,
          },
        });
        closeDesigner();
        setActiveViewId(editingView.id);
        setPage(0);
        // The layout changed under the same template id, so the cached render
        // for this view is stale.
        await qc.invalidateQueries({ queryKey: ["view-render", config.name] });
        toast.success(`Updated “${name}”`);
        return;
      }
      const created = await createView.mutateAsync({
        name,
        template_id: designed.template_id,
        base_sql: designed.base_sql ?? undefined,
      });
      closeDesigner();
      setActiveViewId(created?.id ?? null);
      setPage(0);
      toast.success(`Saved “${name}”`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function closeDesigner() {
    setDesigning(false);
    setEditingView(null);
  }

  function editView(view: SavedView) {
    setEditingView(view);
    setDesigning(true);
  }

  async function saveCurrentView() {
    const name = viewName.trim();
    if (!name) return;
    try {
      const created = await createView.mutateAsync({
        name,
        // `rawSearch`, not the debounced `q`: saving straight after typing
        // should capture what the box says, not the term the list happens to
        // have caught up with 300ms ago.
        search: rawSearch.trim(),
        sort: { col: sort.field, dir: sort.dir },
      });
      setActiveViewId(created?.id ?? null);
      setSavingView(false);
      setViewName("");
      toast.success(`Saved “${name}”`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  // Debounce search input. The page resets with the term rather than in an
  // effect watching it: an effect runs *after* the render that already fired a
  // query, so changing the term while deep in the list sent one request at the
  // old offset — off the end of the new result — before the reset landed.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(rawSearch.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // One page at a time, fetched by the server. The whole table used to arrive
  // in a single 1000-row request, which both stalled the big modules and put
  // every record past the thousandth out of reach — Accounting alone holds
  // 2,262. Search, sort and filters are already applied server-side, so the
  // page is a page of the *result*, not of a slice we then narrow.
  const list = useList(
    config.name,
    {
      q: q || undefined,
      order_by: sort.field,
      order_dir: sort.dir,
      limit: pageSize,
      offset: page * pageSize,
      ...(indexOn && statusField && status ? { [statusField.name]: status } : {}),
    },
    // Hold the previous page on screen while the next one loads, so paging
    // doesn't flash the empty state and collapse the table's height.
    // Skipped entirely for a custom view: its rows come from the report engine,
    // so fetching the grid's page as well would be a wasted round trip.
    { placeholderData: keepPreviousData, enabled: !customView && !calendarOn }
  );

  const rendered = useRenderedView(config.name, customView, page, pageSize);

  const create = useCreate(config.name);
  const update = useUpdate(config.name);
  const del = useDelete(config.name);

  const tableFields = useMemo(
    () => config.fields.filter((f) => f.table),
    [config]
  );
  const refEntities = useMemo(
    () => tableFields.filter((f) => f.ref).map((f) => f.ref as string),
    [tableFields]
  );
  const { labels } = useReferences(refEntities);
  // What a card in the index says under its title: the first few columns that
  // are not already its number, its title or its status.
  const metaFields = useMemo(
    () =>
      tableFields
        .filter((f) => !f.badge && f.name !== config.key && !config.titleFields.includes(f.name))
        .slice(0, 3),
    [tableFields, config]
  );

  const items = list.data?.items ?? [];
  // Both surfaces page the same way; only the source of the count differs.
  const total = customView ? rendered.data?.total ?? 0 : list.data?.total ?? 0;
  // A designed view whose query the server could not count reports no total;
  // say "—" rather than claim "0 records" over a page full of cards.
  const totalKnown = !customView || rendered.data?.total != null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : page * pageSize + 1;
  const lastRow = customView
    ? Math.min(total, (page + 1) * pageSize)
    : Math.min(total, page * pageSize + items.length);
  const loading = customView ? rendered.isLoading : list.isLoading;

  // Deleting the last row of the last page, or any change that shortens the
  // result while paged deep into it, leaves `offset` past the end. Step back to
  // the last page that still has rows rather than showing "no records".
  const fetching = customView ? rendered.isFetching : list.isFetching;
  useEffect(() => {
    if (fetching) return;
    if (total > 0 && page > 0 && page >= pageCount) setPage(pageCount - 1);
  }, [total, page, pageCount, fetching]);

  // `?focus=<id>` opens one record straight away — read-only, in the drill-down
  // panel, the same view a row click gives. Analyze and the action cards link
  // here. Consumed once, then dropped from the URL so a refresh doesn't reopen
  // it. The panel fetches the record by id itself, so it doesn't matter whether
  // it is on the page of the list that happens to be showing.
  const focusId = params.get("focus");
  const focusedOnce = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || focusedOnce.current === focusId) return;
    focusedOnce.current = focusId;
    // In the casebook the record opens on its own page, beside the index; in
    // the ledger (or a designed view) it opens in the panel over the list.
    if (indexOn) {
      setSelId(focusId);
      setShowPage(true);
    } else {
      drill.open({ kind: "record", entity: config.name, id: focusId });
    }
    const next = new URLSearchParams(params);
    next.delete("focus");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  // The index opens on its first record, so the page beside it is never blank
  // while there is something to show. A phone stays on the index until a
  // card is chosen.
  useEffect(() => {
    if (!indexOn || selId != null || items.length === 0) return;
    const first = items[0]._id;
    if (first != null) setSelId(String(first));
  }, [indexOn, selId, items]);

  const pickRecord = (record: Rec) => {
    if (record._id == null) return;
    setSelId(String(record._id));
    setShowPage(true);
    if (onPhone()) window.scrollTo({ top: 0 });
  };

  /** A row opens its record read-only; Edit is a deliberate second step. */
  const openRecord = (record: Rec) => {
    if (record._id == null) return;
    drill.open({ kind: "record", entity: config.name, id: String(record._id) });
  };

  // Re-sorting reorders the whole result, not the page, so the row you were
  // looking at is not on page 4 any more. Go back to the top of the new order.
  const toggleSort = (field: string) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
    setPage(0);
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (record: Rec) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Rec) => {
    try {
      if (editing?._id) {
        await update.mutateAsync({ id: String(editing._id), payload: values });
        // The page beside the index reads the record through the drill query.
        await qc.invalidateQueries({ queryKey: ["drill"] });
        toast.success(`${config.label} updated`);
      } else {
        const made = (await create.mutateAsync(values)) as Rec | undefined;
        // A new record opens on its page, so you see what you just filed.
        if (indexOn && made?._id != null) {
          setSelId(String(made._id));
          setShowPage(true);
        }
        toast.success(`${config.label} created`);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deleting?._id) return;
    try {
      await del.mutateAsync(String(deleting._id));
      toast.success(`${config.label} deleted`);
      if (String(deleting._id) === selId) {
        setSelId(null);
        setShowPage(false);
      }
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const renderCell = (record: Rec, field: FieldDef) => {
    const value = record[field.name];
    if (field.badge) return <Badge value={value} />;
    if (field.ref && value != null && value !== "") {
      const label = labels[field.ref]?.[String(value)];
      return (
        <span title={String(value)}>
          {label ? label : String(value)}
        </span>
      );
    }
    return formatCell(value, field.type);
  };

  const submitting = create.isPending || update.isPending;

  return (
    // `content-fill` gives the TABLE the height the window has left, so the
    // column heads can lock to it while the rows scroll underneath. A designed
    // view is not a table — it is a document, and it has to be allowed to run
    // past the fold and let the page scroll. Locking the page around it clipped
    // everything below the first screen with nothing to scroll.
    <div
      className={`content${
        customView || designing || calendarOn || indexOn ? "" : " content-fill"
      }${calendarOn ? " is-calendar" : ""}${indexOn ? " is-index" : ""}${
        indexOn && showPage ? " is-reading" : ""
      }`}
    >
      <div className="page-head">
        <div className="titles">
          <p>
            Manage your {config.labelPlural.toLowerCase()} — create, edit and track
            records stored in InventDB.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> New {config.label}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <ViewSwitcher
          views={views.data ?? []}
          activeViewId={activeViewId}
          typeLabel={config.labelPlural}
          onApplyView={applyView}
          onApplyAll={applyAllView}
          onNewView={() => {
            setEditingView(null);
            setDesigning(true);
          }}
          onEditView={editView}
          onSaveCurrent={() => {
            setViewName("");
            setSavingView(true);
          }}
          onSetDefault={(view) =>
            // Clicking the star of the view that already holds it unpins it,
            // so the module goes back to opening on the full list.
            setDefaultView.mutate(view.is_default ? null : view.id)
          }
          onDeleteViews={async (ids) => {
            await deleteViews.mutateAsync(ids);
            if (activeViewId && ids.includes(activeViewId)) applyAllView();
          }}
          onRenameView={async (view, name) => {
            await updateView.mutateAsync({ id: view.id, patch: { name } });
          }}
          busy={deleteViews.isPending || setDefaultView.isPending}
        />
        <div className="search input-icon">
          <Search size={16} />
          <input
            className="input"
            placeholder={`Search ${config.labelPlural.toLowerCase()}…`}
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
          />
        </div>
        <div className="cb-seg" role="group" aria-label="Show as">
          <button
            type="button"
            aria-pressed={layout === "index"}
            title="Records as an index, the chosen one open beside it"
            onClick={() => setLayout("index")}
          >
            <BookOpen size={15} aria-hidden /> Index
          </button>
          <button
            type="button"
            aria-pressed={layout === "ledger"}
            title="Records as a table"
            onClick={() => setLayout("ledger")}
          >
            <Table2 size={15} aria-hidden /> Ledger
          </button>
          {config.calendar && (
            <button
              type="button"
              aria-pressed={calendarOn}
              title="Records by day, a month at a time"
              onClick={() => {
                if (customView) applyAllView();
                setLayout("calendar");
              }}
            >
              <CalendarDays size={15} aria-hidden /> Calendar
            </button>
          )}
        </div>
        <span className="count-pill">
          {calendarOn
            ? calCount == null
              ? "…"
              : `${calCount} this month`
            : loading
            ? "…"
            : totalKnown
            ? `${total} records`
            : "— records"}
        </span>
      </div>

      {savingView && (
        <Modal
          title="Save this view"
          narrow
          onClose={() => setSavingView(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setSavingView(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveCurrentView}
                disabled={!viewName.trim() || createView.isPending}
              >
                {createView.isPending ? "Saving…" : "Save view"}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="view-name">Name</label>
            <input
              id="view-name"
              className="input"
              autoFocus
              value={viewName}
              placeholder={
                rawSearch.trim()
                  ? `${config.labelPlural} matching “${rawSearch.trim()}”`
                  : config.labelPlural
              }
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveCurrentView();
                }
              }}
            />
            <p className="field-hint">
              Saves the current search and sort — not the rows. Opening this view
              re-runs it against the latest data.
            </p>
          </div>
        </Modal>
      )}

      {designing && (
        <ViewDesigner
          // Remounts when the target changes, so an edit never opens showing
          // the previous view's design.
          key={editingView?.id ?? "new"}
          entity={config.name}
          typeLabel={config.labelPlural}
          busy={createView.isPending || updateView.isPending}
          editing={
            editingView?.template_id
              ? {
                  id: editingView.id,
                  name: editingView.name,
                  template_id: editingView.template_id,
                  base_sql: editingView.base_sql,
                }
              : null
          }
          onCancel={closeDesigner}
          onSave={saveDesignedView}
        />
      )}

      {list.isError && !customView && !calendarOn && (
        <Alert kind="error">{errorMessage(list.error)}</Alert>
      )}
      {rendered.isError && (
        <Alert kind="error">{errorMessage(rendered.error)}</Alert>
      )}

      {calendarOn ? (
        <CalendarView config={config} month={calMonth} onMonth={setCalMonth} q={q} onCount={setCalCount} />
      ) : customView ? (
        rendered.isLoading ? (
          <div className="custom-view custom-view--busy">
            <Spinner />
          </div>
        ) : (
          // The engine's own markup and CSS, so it goes in the same sandboxed
          // frame a report does — its stylesheet would otherwise fight the
          // app's, and it is not this app's markup to trust.
          <div className="custom-view">
            <ReportFrame
              html={rendered.data?.html ?? ""}
              title={customView.name}
              // Each card is a record: open it read-only, like a table row.
              onRecordClick={(id) => drill.open({ kind: "record", entity: config.name, id })}
              // A view drawn as a table: a row carrying a record number opens it.
              onRecordNumber={(f) => drill.open(f)}
            />
          </div>
        )
      ) : list.isLoading ? (
        <Spinner />
      ) : indexOn && (items.length > 0 || status) ? (
        <div className={`cb-book ${showPage ? "show-detail" : "show-list"}`}>
          <section className="cb-index" aria-label={`${config.labelPlural} index`}>
            {statusField && (
              <div className="cb-chips" role="group" aria-label={statusField.label}>
                {[null, ...(statusField.options ?? [])].map((opt) => (
                  <button
                    key={opt ?? "all"}
                    type="button"
                    className="cb-chip"
                    aria-pressed={status === opt}
                    onClick={() => {
                      setStatus(opt);
                      setPage(0);
                    }}
                  >
                    {opt ?? "All"}
                  </button>
                ))}
              </div>
            )}
            <div className={`cb-index-list${list.isFetching ? " is-paging" : ""}`}>
              {items.length === 0 && (
                <p className="cb-faint" style={{ padding: "12px 0" }}>
                  Nothing in the index matches.
                </p>
              )}
              {items.map((record, idx) => {
                const id = record._id != null ? String(record._id) : null;
                const statusValue = statusField ? record[statusField.name] : undefined;
                const firstBadge = config.fields.find((f) => f.badge);
                return (
                  <button
                    key={id ?? idx}
                    type="button"
                    className="cb-card"
                    aria-current={id === selId ? "true" : undefined}
                    onClick={() => pickRecord(record)}
                  >
                    <span className="no">
                      <span>{config.hideKeyColumn ? "" : String(record[config.key] ?? "")}</span>
                      {statusField ? (
                        statusValue != null && statusValue !== "" && <Badge value={statusValue} />
                      ) : (
                        firstBadge && <Badge value={record[firstBadge.name]} />
                      )}
                    </span>
                    <span className="cap">{recordTitle(config, record)}</span>
                    {metaFields.length > 0 && (
                      <span className="meta">
                        {metaFields.map((f) =>
                          record[f.name] == null || record[f.name] === "" ? null : (
                            <span key={f.name} title={f.label}>
                              {renderCell(record, f)}
                            </span>
                          )
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="cb-index-pager">
              <span aria-live="polite">
                {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {total.toLocaleString()}
              </span>
              {pageCount > 1 && (
                <span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Previous page"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Next page"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </span>
              )}
            </div>
          </section>
          {selId ? (
            <RecordPaper
              key={selId}
              entity={config.name}
              id={selId}
              onEdit={openEdit}
              onDelete={setDeleting}
              onBack={() => setShowPage(false)}
            />
          ) : (
            <article className="cb-paper">
              <div className="cb-margin" aria-hidden />
              <div className="cb-pbody">
                <div className="cb-blank">
                  <h2>Nothing open</h2>
                  <p>Choose a record from the index to read it here.</p>
                </div>
              </div>
            </article>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            title={q ? "No matching records" : `No ${config.labelPlural.toLowerCase()} yet`}
            message={
              q
                ? "Try a different search term."
                : `Add your first ${config.label.toLowerCase()} to get started.`
            }
            action={
              !q && (
                <button className="btn btn-primary" onClick={openCreate}>
                  <Plus size={16} /> New {config.label}
                </button>
              )
            }
          />
        </div>
      ) : (
        <ScrollX className={`table-wrap ${list.isFetching ? "is-paging" : ""}`}>
          <table className="data">
            <thead>
              <tr>
                {!config.hideKeyColumn && <th className="no-sort">{config.key}</th>}
                {tableFields.map((f) => (
                  <th key={f.name} className={isAmount(f) ? "cb-amt" : undefined} onClick={() => toggleSort(f.name)}>
                    <span className="th-sort">
                      {f.label}
                      {sort.field === f.name &&
                        (sort.dir === "asc" ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        ))}
                    </span>
                  </th>
                ))}
                <th className="no-sort" style={{ textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((record, idx) => (
                <tr
                  key={String(record._id ?? record[config.key] ?? idx)}
                  className="is-drillable"
                  tabIndex={0}
                  title="Open this record"
                  onClick={() => openRecord(record)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target === e.currentTarget) openRecord(record);
                  }}
                >
                  {!config.hideKeyColumn && (
                    <td className="cb-key" data-label={config.key}>
                      {String(record[config.key] ?? "—")}
                    </td>
                  )}
                  {tableFields.map((f) => (
                    <td key={f.name} data-label={f.label} className={isAmount(f) ? "cb-amt" : undefined}>
                      {renderCell(record, f)}
                    </td>
                  ))}
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button
                        className="btn-icon"
                        title="Edit"
                        onClick={() => openEdit(record)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Delete"
                        onClick={() => setDeleting(record)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      )}

      {/* Gated on the RESULT, not on `items`: a custom view is rendered by the
          engine and never fills `items`, so keying off it left the pager
          appearing only when stale table rows happened to still be in cache. */}
      {total > 0 && !calendarOn && !indexOn && (
        <nav className="pager" aria-label={`${config.labelPlural} pagination`}>
          <p className="pager-status" aria-live="polite">
            Showing <b>{firstRow.toLocaleString()}</b>–<b>{lastRow.toLocaleString()}</b> of{" "}
            <b>{total.toLocaleString()}</b>
          </p>
          <div className="pager-controls">
            <label className="pager-size">
              <span>Rows</span>
              <select
                className="input"
                value={pageSize}
                aria-label="Rows per page"
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="pager-nav">
              <button
                className="btn-icon"
                title="First page"
                aria-label="First page"
                disabled={page === 0}
                onClick={() => setPage(0)}
              >
                <ChevronFirst size={16} />
              </button>
              <button
                className="btn-icon"
                title="Previous page"
                aria-label="Previous page"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pager-page">
                Page {(page + 1).toLocaleString()} of {pageCount.toLocaleString()}
              </span>
              <button
                className="btn-icon"
                title="Next page"
                aria-label="Next page"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                <ChevronRight size={16} />
              </button>
              <button
                className="btn-icon"
                title="Last page"
                aria-label="Last page"
                disabled={page >= pageCount - 1}
                onClick={() => setPage(pageCount - 1)}
              >
                <ChevronLast size={16} />
              </button>
            </div>
          </div>
        </nav>
      )}

      {modalOpen && (
        <Modal
          title={editing ? `Edit ${config.label}` : `New ${config.label}`}
          onClose={() => setModalOpen(false)}
        >
          <EntityForm
            config={config}
            initial={editing}
            submitting={submitting}
            // Creating is where a description saves the most work — and where
            // it is safe, because there is nothing yet for it to overwrite.
            // Editing keeps the form it has always had.
            assist={!editing}
            onSubmit={handleSubmit}
            onCancel={() => setModalOpen(false)}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${config.label}`}
          message={`Are you sure you want to delete "${recordTitle(config, deleting)}"? This cannot be undone.`}
          busy={del.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
