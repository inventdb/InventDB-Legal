/**
 * The papers that belong to the record on screen, in the drill-down panel.
 *
 * Two kinds, both listed by `GET /api/drill/<module>/<id>/files`: files
 * ATTACHED to the record, and the firm's documents FILED under its number in
 * the folder tree (a matter's papers sit in "…/MT-2599 Estate of …/"). Each
 * row says which. Opening one shows it in the same file view the Files room
 * uses — preview, details, extracted text, versions — above the panel, so
 * closing it lands back here.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Paperclip } from "lucide-react";

import { api, errorMessage } from "../api/client";
import { FileDetail } from "../files/FileDetail";
import { baseName, fileSizeLabel } from "../files/model";
import type { FileRow } from "../types";

type DrillFile = FileRow & { filed_under?: string | null };

/** Folder shown under a file: the part below its matter's folder, if any. */
function where(file: DrillFile): string {
  const parts = String(file.folder_path || "").split("/").filter(Boolean);
  if (file.filed_under) {
    const at = parts.findIndex((p) => p === file.filed_under || p.startsWith(`${file.filed_under} `));
    if (at >= 0 && at < parts.length - 1) return parts.slice(at + 1).join(" › ");
    if (at >= 0) return parts[at];
  }
  return parts.slice(-2).join(" › ");
}

export function DrillFiles({ entity, recordId, label }: { entity: string; recordId: string; label: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<DrillFile | null>(null);
  const q = useQuery({
    queryKey: ["drill", "files", entity, recordId],
    queryFn: async () =>
      (await api.get<{ files: DrillFile[]; numbers: string[] }>(
        `/drill/${entity}/${encodeURIComponent(recordId)}/files`
      )).data,
  });
  const files = q.data?.files ?? [];

  return (
    <section className="drill-section" aria-label="Files">
      <header className="drill-section-head">
        <h3>Files</h3>
        <span className="drill-count">{q.isLoading ? "…" : files.length.toLocaleString()}</span>
      </header>
      {q.isError ? (
        <p className="drill-error">{errorMessage(q.error)}</p>
      ) : q.isLoading ? (
        <p className="drill-muted">Loading…</p>
      ) : files.length === 0 ? (
        <p className="drill-muted">No files attached to or filed under this {label.toLowerCase()}.</p>
      ) : (
        <ul className="drill-files">
          {files.map((f) => (
            <li key={String(f.attachment_id)}>
              <button className="drill-file" onClick={() => setOpen(f)} title={f.folder_path || undefined}>
                <FileText size={15} aria-hidden className="drill-file-ico" />
                <span className="drill-file-main">
                  <span className="drill-file-name">{baseName(String(f.filename || ""))}</span>
                  <span className="drill-file-sub">
                    {f.filed_under ? (
                      <>Filed under {f.filed_under}{where(f) ? ` · ${where(f)}` : ""}</>
                    ) : (
                      <>
                        <Paperclip size={11} aria-hidden /> Attached
                      </>
                    )}
                    {f.size_bytes != null && <> · {fileSizeLabel(Number(f.size_bytes))}</>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <FileDetail
          file={open}
          onClose={() => setOpen(null)}
          onDeleted={() => {
            setOpen(null);
            void qc.invalidateQueries({ queryKey: ["drill", "files", entity, recordId] });
          }}
        />
      )}
    </section>
  );
}
