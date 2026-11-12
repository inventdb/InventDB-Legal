import type { ReactNode } from "react";

import { toneForValue } from "../config/entities";

export function Spinner() {
  return (
    <div className="center-box">
      <div className="spinner" aria-label="Loading" role="status" />
    </div>
  );
}

export function Badge({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <>—</>;
  return <span className={`badge ${toneForValue(value)}`}>{String(value)}</span>;
}

/** An empty case folder, drawn in the firm's line style: the empty state's mark. */
export function EmptyFolder() {
  return (
    <svg width="120" height="78" viewBox="0 0 150 96" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M20 22h40l8-8h62v72H20z" />
      <path d="M20 34h110" />
      <rect x="44" y="46" width="62" height="28" fill="var(--accent-soft)" />
      <path d="M54 56h42M54 64h30" />
    </svg>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-ico">{icon ?? <EmptyFolder />}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  /** `warn` is for a result that stands but deserves a second look — an
   *  accepted workflow plan the engine still has reservations about. */
  kind?: "error" | "success" | "info" | "warn";
  children: ReactNode;
}) {
  return <div className={`alert ${kind}`}>{children}</div>;
}
