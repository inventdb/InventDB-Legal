import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import type { DrillFrame } from "../drill/DrillContext";
import { recordFrame, rowFrame } from "../drill/keys";

/** What a parent can do with a rendered report. */
export interface ReportFrameHandle {
  print: () => void;
}

/**
 * Displays a report rendered by InventDB's report engine.
 *
 * The payload is a whole HTML document — the template's own markup, CSS and
 * inline SVG charts — authored in SOAR, not by this app. That rules out
 * dropping it into the page with `dangerouslySetInnerHTML`:
 *
 *  - its stylesheet would fight (and win against) the app's own; report
 *    templates style bare `table`, `h1`, `body` and so on, and
 *  - anything an inline `onclick`/`onerror` carried would execute with the
 *    app's session in scope.
 *
 * A `srcdoc` iframe sandboxed to `allow-same-origin` (deliberately *without*
 * `allow-scripts`) gives real isolation on both counts: the document gets its
 * own styling context, and no script in it can run. `allow-same-origin` is
 * what lets this component measure the content and drive Print — safe here
 * precisely because scripts are off, so nothing inside can reach back out.
 * The engine's own scripts are `<script type="server">` blocks, executed
 * server-side and stripped before the HTML is returned, so nothing a report
 * needs is lost.
 *
 * The frame grows to its content instead of scrolling internally, so a report
 * reads as one continuous sheet.
 */
/**
 * Force the document to flow at its natural height.
 *
 * A generated layout frequently declares its own page: `html,body{height:100vh}`,
 * or a wrapper with `max-height` and `overflow:auto`. Inside a frame that is
 * sized from its content, that produces the worst of both — the frame measures
 * the collapsed height and the rows scroll in a nested scroller the wheel can
 * barely reach.
 *
 * Only the page box and body's own children are neutralised. Anything deeper
 * keeps its overflow, so a wide table inside a card still scrolls sideways
 * where it should.
 */
const FLOW_RESET = `
<style>
  html, body {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  body > * {
    max-height: none !important;
    overflow-y: visible !important;
  }
</style>`;

/** Append the reset so it wins over whatever the document declared. */
function withFlowReset(html: string): string {
  if (!html) return html;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${FLOW_RESET}</body>`)
    : html + FLOW_RESET;
}

/**
 * Stop native drag-and-drop inside the frame.
 *
 * Pressing on an image (a photo in a card view) and moving the mouse
 * a few pixels starts the browser's own image drag. Inside a sandboxed srcdoc
 * frame that drag session never ends: the page stops responding until it is
 * reloaded, and a reload of a card view lands straight back on it. Nothing in a
 * report or a layout is meant to be dragged, so images and links are made
 * undraggable and any drag that still starts is cancelled. With no drag, the
 * press stays an ordinary click — the card opens.
 */
const NO_DRAG_CSS = `
img, a, svg { -webkit-user-drag: none; user-drag: none; }`;

function disableDrag(doc: Document): () => void {
  const style = doc.createElement("style");
  style.textContent = NO_DRAG_CSS;
  doc.head?.appendChild(style);
  doc.querySelectorAll("img, a").forEach((el) => el.setAttribute("draggable", "false"));
  const cancel = (e: DragEvent) => e.preventDefault();
  doc.addEventListener("dragstart", cancel, true);
  return () => {
    doc.removeEventListener("dragstart", cancel, true);
    style.remove();
  };
}

/**
 * Hand Escape to the page.
 *
 * A key pressed while focus is inside the frame goes to the frame's own
 * document, so the page's Esc handlers (closing the drill panel, a dialog)
 * never hear it. Re-dispatch it on the page so Esc behaves the same wherever
 * focus happens to be.
 */
function forwardEscape(doc: Document, page: Document): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    page.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  };
  doc.addEventListener("keydown", onKey);
  return () => doc.removeEventListener("keydown", onKey);
}

/** Styling for records that open on click, injected only when they do. */
const CLICKABLE_CSS = `
[data-record-id] { cursor: pointer; }
[data-record-id]:hover, [data-record-id]:focus-visible {
  outline: 2px solid rgba(106, 34, 157, 0.45);
  outline-offset: 2px;
}`;

/**
 * Make every `[data-record-id]` element in the document open its record.
 *
 * Layouts mark each record they draw with `data-record-id` (its `_id`). The
 * frame runs no scripts of its own, so the listeners are attached from here —
 * a parent's listener on a same-origin sandboxed document still fires, while
 * nothing in the document can run. Cards become focusable buttons as well, so
 * Enter and Space open them for keyboard users.
 */
function wireRecordClicks(doc: Document, open: (id: string) => void): () => void {
  const style = doc.createElement("style");
  style.textContent = CLICKABLE_CSS;
  doc.head?.appendChild(style);
  doc.querySelectorAll<HTMLElement>("[data-record-id]").forEach((el) => {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
  });
  const idOf = (target: EventTarget | null): string | null => {
    const el = (target as Element | null)?.closest?.("[data-record-id]");
    const id = el?.getAttribute("data-record-id");
    return id && id.trim() ? id.trim() : null;
  };
  const onClick = (e: MouseEvent) => {
    const id = idOf(e.target);
    if (!id) return;
    e.preventDefault();
    open(id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const id = idOf(e.target);
    if (!id) return;
    e.preventDefault();
    open(id);
  };
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKey);
  return () => {
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("keydown", onKey);
    style.remove();
  };
}

/** Styling for table rows that open the record they are about. */
const ROW_CSS = `
tr[data-record-number] { cursor: pointer; }
tr[data-record-number]:hover > td, tr[data-record-number]:focus-visible > td {
  background: rgba(106, 34, 157, 0.07);
}
tr[data-record-number]:focus-visible { outline: 2px solid rgba(106, 34, 157, 0.45); outline-offset: -2px; }`;

/**
 * Make every table row that is about one record open it.
 *
 * A report's tables are plain HTML: no `_id`, no query to trace. But a row
 * about a record carries its number (MT-2599, INV-2026-1562), and a number
 * names exactly one record — so the first cell holding one marks the row, and
 * a click (or Enter / Space) opens that record. Listeners are attached from
 * here, as for cards: nothing in the document runs.
 */
function wireRowClicks(doc: Document, open: (frame: Extract<DrillFrame, { kind: "record" }>) => void): () => void {
  let marked = 0;
  doc.querySelectorAll<HTMLTableRowElement>("tr").forEach((tr) => {
    if (tr.closest("thead") || tr.closest("[data-record-id]") || !tr.querySelector("td")) return;
    const frame = rowFrame(Array.from(tr.cells).map((c) => c.textContent || ""));
    if (!frame?.match) return;
    tr.setAttribute("data-record-number", String(frame.match.value));
    if (!tr.hasAttribute("tabindex")) tr.setAttribute("tabindex", "0");
    tr.setAttribute("role", "button");
    marked++;
  });
  if (!marked) return () => {};
  const style = doc.createElement("style");
  style.textContent = ROW_CSS;
  doc.head?.appendChild(style);
  const frameOf = (target: EventTarget | null) => {
    const el = target as Element | null;
    if (el?.closest?.("a[href], button, [data-record-id]")) return null; // its own action wins
    return recordFrame(el?.closest?.("tr[data-record-number]")?.getAttribute("data-record-number"));
  };
  const onClick = (e: MouseEvent) => {
    const frame = frameOf(e.target);
    if (!frame) return;
    e.preventDefault();
    open(frame);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const frame = frameOf(e.target);
    if (!frame) return;
    e.preventDefault();
    open(frame);
  };
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKey);
  return () => {
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("keydown", onKey);
    style.remove();
  };
}

export const ReportFrame = forwardRef<
  ReportFrameHandle,
  {
    html: string;
    title: string;
    /** Open a record when an element marked `data-record-id` is clicked. */
    onRecordClick?: (id: string) => void;
    /** Open the record a table row is about, by the record number it carries. */
    onRecordNumber?: (frame: Extract<DrillFrame, { kind: "record" }>) => void;
  }
>(function ReportFrame({ html, title, onRecordClick, onRecordNumber }, handle) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
  // The latest handler, read at click time, so a re-render never has to
  // re-wire the document.
  const openRef = useRef(onRecordClick);
  openRef.current = onRecordClick;
  const openNumberRef = useRef(onRecordNumber);
  openNumberRef.current = onRecordNumber;
  const unwire = useRef<(() => void) | null>(null);
  const clickable = !!onRecordClick;
  const rowsOpen = !!onRecordNumber;

  useImperativeHandle(handle, () => ({
    print: () => ref.current?.contentWindow?.print(),
  }));

  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (!doc?.documentElement) return;
    // scrollHeight on the root, not the body: body alone under-measures when
    // the template sets its own margins.
    const next = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0
    );
    // Never shrink below what has already been shown: a mid-reflow read can
    // come back short and the frame would visibly collapse and re-expand.
    if (next > 0) setHeight((h) => (Math.abs(next - h) < 2 ? h : next));
  }, []);

  // Web fonts and images land after load and change the height, and the frame
  // reflows whenever the column width changes. Watch the document rather than
  // measuring once.
  useEffect(() => {
    const doc = ref.current?.contentDocument;
    if (!doc?.body || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(doc.body);
    return () => ro.disconnect();
  }, [measure, html]);

  // Every load of the srcdoc is a new document, so wire it on load.
  const onLoad = useCallback(() => {
    measure();
    unwire.current?.();
    unwire.current = null;
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    const undrag = disableDrag(doc);
    const unesc = ref.current?.ownerDocument ? forwardEscape(doc, ref.current.ownerDocument) : null;
    const unclick = clickable ? wireRecordClicks(doc, (id) => openRef.current?.(id)) : null;
    const unrows = rowsOpen ? wireRowClicks(doc, (frame) => openNumberRef.current?.(frame)) : null;
    unwire.current = () => {
      undrag();
      unesc?.();
      unclick?.();
      unrows?.();
    };
  }, [measure, clickable, rowsOpen]);
  useEffect(() => () => unwire.current?.(), []);

  return (
    <iframe
      ref={ref}
      className="report-frame"
      title={title}
      srcDoc={withFlowReset(html)}
      onLoad={onLoad}
      style={{ height }}
      sandbox="allow-same-origin allow-modals"
    />
  );
});

export default ReportFrame;
