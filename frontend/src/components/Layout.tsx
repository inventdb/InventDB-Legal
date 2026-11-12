/**
 * The signed-in frame: the casebook.
 *
 * The firm's floors are folder tabs along the top, the same floors the login
 * page draws, and the open floor's sections run along the strip beneath them.
 * Every page then opens under one serif title. On a phone the tabs give way
 * to a short floor header, a bottom bar for the places a lawyer reaches for
 * most, and "All sections" — the whole building on one sheet.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Briefcase,
  Clock3,
  Home,
  Hourglass,
  LayoutGrid,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";

import { ENTITY_BY_NAME } from "../config/entities";
import {
  FLOORS,
  SECTIONS,
  floorKicker,
  floorOf,
  sectionPath,
  type Floor,
  type Section,
} from "../config/floors";
import { useAuth } from "../auth/AuthContext";
import { usePendingApprovalCount } from "../api/hooks";
import { useTheme } from "../theme/ThemeContext";
import { BrandLockup } from "./BrandLockup";
import { GlobalSearch, SearchHits, hitPath, useFirmSearch } from "./GlobalSearch";

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  if (seg === "analyze") return "Analyze";
  if (seg === "reports") return "Reports";
  if (seg === "workflows") return "Workflows";
  if (seg === "files") return "Files";
  if (seg === "import") return "Import";
  if (seg === "settings") return "Settings";
  return ENTITY_BY_NAME[seg]?.labelPlural ?? "InventDB Legal";
}

/** The four places a phone user reaches for most; everything else is a tap on "All sections". */
const BOTTOM = [
  { to: "/", label: "Reception", Icon: Home, end: true },
  { to: "/matters", label: "Matters", Icon: Briefcase },
  { to: "/deadlines_and_sol", label: "Docket", Icon: Hourglass },
  { to: "/time_entries", label: "Time", Icon: Clock3 },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  // A workflow parks whenever it reaches a decision — which is to say, while
  // you are somewhere else in the app. Polled from the shell so it keeps
  // arriving without anyone having to sit on the Workflows page waiting for it.
  const waiting = usePendingApprovalCount();

  const [dirOpen, setDirOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const floor = floorOf(location.pathname);
  const here = sectionPath(location.pathname);
  const title = pageTitle(location.pathname);

  // Any move closes whatever was summoned to make it.
  useEffect(() => {
    setDirOpen(false);
    setSearchOpen(false);
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  // Where the page's own content starts is measured, not guessed: a module
  // list fills exactly the height the window has left below the frame and the
  // title (see `.content-fill`), so its column heads can lock while the rows
  // scroll. Re-measured when the frame or the title changes size.
  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = stage.current;
      if (!el) return;
      const top = Math.ceil(el.getBoundingClientRect().bottom + window.scrollY);
      shell.current?.style.setProperty("--fill-top", `${top}px`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (frame.current) ro.observe(frame.current);
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, [location.pathname]);

  // Tab / Shift+Tab in the section strip walk the whole building in order and
  // open each section as they reach it — across floors too, so the next tab
  // after a floor's last section is the first section of the floor above.
  // Scoped to the strip on purpose: Tab is how you move between fields, and
  // hijacking it everywhere would throw you out of a half-filled form.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const to = pendingFocus.current;
    if (!to) return;
    pendingFocus.current = null;
    document.querySelector<HTMLAnchorElement>(`nav.nav a.nav-item[href="${to}"]`)?.focus();
  }, [location.pathname]);

  const initials = String(user?.username ?? "?")
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const badgeFor = (s: Section) => (s.badge === "approvals" ? waiting : 0);
  const floorBadge = (f: Floor) => f.sections.reduce((n, s) => n + badgeFor(s), 0);

  return (
    <div className="app-shell" ref={shell}>
      <div className="cb-frame" ref={frame}>
        <header className="topbar cb-mast">
          <Link to="/" className="cb-lock" aria-label="InventDB Legal, go to Reception">
            <BrandLockup />
          </Link>
          <GlobalSearch />
          <span className="cb-spacer" />
          <button
            type="button"
            className="cb-icon m-only"
            aria-label="Search the whole firm"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} />
          </button>
          <Link
            to="/workflows"
            className="cb-icon"
            aria-label={waiting ? `Notifications, ${waiting} waiting on you` : "Notifications"}
            title={waiting ? `${waiting} waiting on you` : "Nothing is waiting on you"}
          >
            <Bell size={18} />
            {waiting > 0 && <span className="cb-dot">{waiting}</span>}
          </Link>
          <button
            type="button"
            className="cb-icon d-only"
            onClick={toggle}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun key="sun" size={18} /> : <Moon key="moon" size={18} />}
          </button>
          <AccountMenu
            open={menuOpen}
            onOpen={setMenuOpen}
            initials={initials || "?"}
            name={String(user?.username ?? "")}
            theme={theme}
            onTheme={toggle}
            onDirectory={() => setDirOpen(true)}
            onSettings={() => navigate("/settings")}
            onSignOut={logout}
          />
        </header>

        <div className="cb-floorbar">
          <nav className="cb-folders" aria-label="Floors">
            {FLOORS.map((f) => {
              const n = floorBadge(f);
              return (
                <Link
                  key={f.num}
                  to={f.sections[0].to}
                  className={`cb-folder${f.back ? " cb-folder-back" : ""}`}
                  aria-current={f === floor ? "page" : undefined}
                >
                  <span className="fn">
                    {floorKicker(f)}
                    {n > 0 && <span className="cb-badge">{n}</span>}
                  </span>
                  <span className="fl">{f.name}</span>
                </Link>
              );
            })}
          </nav>
          <div className={`cb-strip${floor.sections.length > 1 ? "" : " is-single"}`}>
            <div className="cb-strip-floor">
              <span className="fn">{floorKicker(floor)}</span>
              <span className="fname">{floor.name}</span>
            </div>
            <span className="cb-script">{floor.script}</span>
            <nav
              className="nav"
              aria-label="Sections on this floor"
              onKeyDown={(e) => {
                if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
                const at = SECTIONS.findIndex(
                  (s) => s.to === (document.activeElement as HTMLAnchorElement)?.getAttribute("href")
                );
                if (at === -1) return;
                const next = at + (e.shiftKey ? -1 : 1);
                // Off either end of the building: let Tab do its ordinary job.
                if (next < 0 || next >= SECTIONS.length) return;
                e.preventDefault();
                const to = SECTIONS[next].to;
                const sameFloor = floor.sections.some((s) => s.to === to);
                if (sameFloor) {
                  document.querySelector<HTMLAnchorElement>(`nav.nav a.nav-item[href="${to}"]`)?.focus();
                } else {
                  pendingFocus.current = to;
                }
                navigate(to);
              }}
            >
              {floor.sections.map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={s.end}
                  className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
                >
                  {s.label}
                  {badgeFor(s) > 0 && (
                    <span className="nav-badge" aria-label={`${badgeFor(s)} waiting on you`}>
                      {badgeFor(s)}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
            <span className="cb-strip-end">
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setDirOpen(true)}>
                All sections
              </button>
            </span>
          </div>
        </div>
      </div>

      {/* The route key drives the page transition: a new pathname remounts the
          subtree, so the entrance animations in global.css replay. Page
          components already reset their own state per route (EntityListPage
          keys on the entity), so the remount costs no behaviour. */}
      <main className="page" key={location.pathname}>
        <div className="cb-stage" ref={stage}>
          <h1>{title}</h1>
        </div>
        <Outlet />
      </main>

      <nav className="cb-bnav" aria-label="Main">
        {BOTTOM.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="cb-bnav-item">
            <Icon size={20} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="cb-bnav-item"
          aria-current={dirOpen || !BOTTOM.some((b) => b.to === here) ? "page" : undefined}
          aria-label={`All sections${waiting ? `, ${waiting} waiting on you` : ""}`}
          onClick={() => setDirOpen(true)}
        >
          <LayoutGrid size={20} aria-hidden />
          <span>All sections</span>
          {waiting > 0 && <span className="cb-badge">{waiting}</span>}
        </button>
      </nav>

      {dirOpen && <Directory here={here} badgeFor={badgeFor} onClose={() => setDirOpen(false)} />}
      {searchOpen && <PhoneSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function AccountMenu({
  open,
  onOpen,
  initials,
  name,
  theme,
  onTheme,
  onDirectory,
  onSettings,
  onSignOut,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  initials: string;
  name: string;
  theme: "light" | "dark";
  onTheme: () => void;
  onDirectory: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpen]);

  const run = (fn: () => void) => () => {
    onOpen(false);
    fn();
  };

  return (
    <div className="cb-wrap" ref={box}>
      <button
        type="button"
        className="avatar"
        aria-label="Your account"
        aria-expanded={open}
        aria-haspopup="menu"
        title={name}
        onClick={() => onOpen(!open)}
      >
        {initials}
      </button>
      {open && (
        <div className="cb-pop cb-menu" role="menu">
          <div className="cb-who">
            Signed in as
            <b>{name}</b>
          </div>
          <button type="button" role="menuitem" onClick={run(onDirectory)}>
            All sections
          </button>
          <button type="button" role="menuitem" onClick={run(onTheme)}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" role="menuitem" onClick={run(onSettings)}>
            Settings
          </button>
          <button type="button" role="menuitem" onClick={run(onSignOut)}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Every section of the app, floor by floor: the map of the building. */
function Directory({
  here,
  badgeFor,
  onClose,
}: {
  here: string;
  badgeFor: (s: Section) => number;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const find = useRef<HTMLInputElement>(null);
  useEffect(() => {
    find.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const term = q.trim().toLowerCase();
  const floors = FLOORS.map((f) => ({
    f,
    sections: f.sections.filter(
      (s) => !term || s.label.toLowerCase().includes(term) || f.name.toLowerCase().includes(term)
    ),
  })).filter((x) => x.sections.length > 0);

  return (
    <>
      <div className="cb-scrim" onMouseDown={onClose} />
      <aside className="cb-sheet cb-dir" role="dialog" aria-modal="true" aria-label="All sections">
        <div className="cb-sheet-head">
          <div>
            <div className="k">The building</div>
            <h2>All sections</h2>
          </div>
          <button type="button" className="cb-icon" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="cb-sheet-body">
          <label className="cb-find">
            <Search size={16} aria-hidden />
            <span className="sr-only">Find a section</span>
            <input
              ref={find}
              value={q}
              placeholder="Find a section"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {floors.length === 0 && <p className="cb-faint">No section has that name.</p>}
          {floors.map(({ f, sections }) => (
            <section key={f.num} className="cb-dir-floor" aria-label={f.name}>
              <div className="cb-dir-head">
                <span className="fn">{floorKicker(f)}</span>
                <b>{f.name}</b>
                <span className="cb-script">{f.script}</span>
              </div>
              {sections.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="cb-dir-row"
                  aria-current={s.to === here ? "page" : undefined}
                  aria-label={badgeFor(s) > 0 ? `${s.label}, ${badgeFor(s)} waiting on you` : undefined}
                  onClick={onClose}
                >
                  <span>{s.label}</span>
                  <span className="cb-dir-meta">
                    {badgeFor(s) > 0 && <span className="cb-badge">{badgeFor(s)} waiting</span>}
                    <span aria-hidden>›</span>
                  </span>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

/** Search on a phone takes the whole screen. */
function PhoneSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const { hits, ready, loading, pending } = useFirmSearch(term);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cb-msearch" role="dialog" aria-modal="true" aria-label="Search the whole firm">
      <div className="cb-msearch-bar">
        <button type="button" className="cb-icon" aria-label="Close search" onClick={onClose}>
          <ArrowLeft size={18} />
        </button>
        <label className="cb-gfield">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search the whole firm</span>
          <input
            autoFocus
            value={term}
            placeholder="Search matters, clients, invoices"
            autoComplete="off"
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
      </div>
      <div className="cb-msearch-list" role="listbox" aria-label="Search results">
        {ready ? (
          <SearchHits
            term={term}
            hits={hits}
            loading={loading || pending}
            onPick={(h) => navigate(hitPath(h))}
          />
        ) : (
          <p className="cb-gres-none">Type two letters or more: a caption, a client, an invoice number.</p>
        )}
      </div>
    </div>
  );
}
