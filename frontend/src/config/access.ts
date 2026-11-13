/**
 * What the signed-in person may reach, as the backend worked it out.
 *
 * `GET /api/auth/access` turns the person's InventDB Legal role into a tier and
 * sends back the sections, modules, reports and rooms that tier gets. The
 * backend enforces the same table on every request (`backend/app/access.py`),
 * and InventDB's own grants sit behind that, so hiding things here is a
 * convenience, not the boundary.
 *
 * The tier key is used only to pick a dashboard. Nothing on screen names it:
 * people sign in and land in their own part of the firm without being told
 * what that part is called.
 *
 * Kept as a small module store as well as on the auth context, because some
 * helpers that filter module lists (search, relations, file trees) are plain
 * functions, not components.
 */

export type Tier = "admin" | "partner" | "attorney" | "paralegal" | "intake" | "finance";

export interface AccessMap {
  provisioned: boolean;
  tier: Tier | null;
  /** Frontend paths shown in the sidebar, in order: "/", "/matters", "/reports" … */
  sections: string[];
  /** Module -> "read" | "write". A module that is absent is not visible. */
  entities: Record<string, "read" | "write">;
  /** Named reports under /reports (pnl, cashflow, deadlines …). */
  reports: string[];
  /** Rooms: files, reports, analyze, workflows, import, admin_settings. */
  rooms: string[];
}

let current: AccessMap | null = null;

export function setCurrentAccess(next: AccessMap | null): void {
  current = next;
}

export function currentAccess(): AccessMap | null {
  return current;
}

export function canRead(entity: string): boolean {
  return !!current?.entities?.[entity];
}

export function canWrite(entity: string): boolean {
  return current?.entities?.[entity] === "write";
}

export function canOpen(path: string): boolean {
  return !!current?.sections?.includes(path);
}

export function hasRoom(room: string): boolean {
  return !!current?.rooms?.includes(room);
}

export function canSeeReport(name: string): boolean {
  return !!current?.reports?.includes(name);
}
