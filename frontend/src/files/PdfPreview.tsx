/**
 * A PDF drawn by the app itself, page by page, onto canvases.
 *
 * Not an <iframe>: Chrome will not run its PDF viewer inside a sandboxed frame
 * ("This page has been blocked by Chrome"), and an unsandboxed one would hand a
 * document from outside this app a browsing context of its own. PDF.js reads
 * the bytes and paints pixels, so the file never becomes a page at all — its
 * scripts, forms and links have nothing to run in.
 *
 * PDF.js is loaded only when a PDF is first previewed, so it costs nothing to
 * anyone who never opens one.
 */
import { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { errorMessage } from "../api/client";
import { fileBytes, type FileHome } from "../api/hooks";
import { Alert, Spinner } from "../components/ui";

/** Pages drawn up front. A longer document says how many more there are. */
const MAX_PAGES = 30;

export function PdfPreview({ home, name }: { home: FileHome; name?: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<{ shown: number; total: number }>({ shown: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    setState("loading");
    setError(null);
    holder.current?.replaceChildren();

    (async () => {
      const [pdfjs, bytes] = await Promise.all([import("pdfjs-dist"), fileBytes(home)]);
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const task = pdfjs.getDocument({ data: new Uint8Array(bytes), enableXfa: false });
      destroy = () => void task.destroy();
      const pdf = await task.promise;
      if (cancelled) return;

      const shown = Math.min(pdf.numPages, MAX_PAGES);
      const width = holder.current?.clientWidth || 640;
      const ratio = window.devicePixelRatio || 1;
      for (let n = 1; n <= shown; n++) {
        const page = await pdf.getPage(n);
        if (cancelled) return;
        const fit = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / fit.width) * ratio });
        const canvas = document.createElement("canvas");
        canvas.className = "fx-pdf-page";
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${name || "Document"}, page ${n} of ${pdf.numPages}`);
        holder.current?.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
        if (n === 1 && !cancelled) setState("ready");
      }
      if (!cancelled) setPages({ shown, total: pdf.numPages });
    })().catch((err) => {
      if (cancelled) return;
      setError(errorMessage(err));
      setState("error");
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [home, name]);

  return (
    <div className="fx-pdf">
      {state === "loading" && <Spinner />}
      {state === "error" && <Alert kind="error">{error || "This PDF could not be shown — download it to open it."}</Alert>}
      <div ref={holder} className="fx-pdf-pages" data-testid="pdf-preview" />
      {pages.total > pages.shown && (
        <p className="report-note">
          Showing the first {pages.shown} of {pages.total} pages — download the file for the rest.
        </p>
      )}
    </div>
  );
}
