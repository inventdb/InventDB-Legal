/**
 * The signed-in frame: chambers.
 *
 * An oxblood bench bar runs across the top: the lockup, search, what is
 * waiting on you, day or night, and your account. The firm's groups run down
 * a sidebar on the left, each heading with its sections listed under it, so
 * every section is one click away. Every page then opens under one serif
 * title.
 *
 * Below 1000px the sidebar steps aside: the open group's sections become tabs
 * above the page and the menu button opens "All sections". On a phone a bottom
 * bar holds the places a lawyer reaches for most.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Briefcase,
  CalendarDays,
  Clock3,
  Home,
  LayoutGrid,
  Menu,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
  X,
} from "lucide-react";

import { ENTITY_BY_NAME } from "../config/entities";
import { FLOORS, SECTIONS, floorOf, sectionPath, type Floor, type Section } from "../config/floors";
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
  { to: "/court_calendar", label: "Calendar", Icon: CalendarDays },
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
  const frame = useRef<HTMLElement>(null);
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

  // Tab / Shift+Tab in the sidebar walk the whole firm in order and open each
  // section as they reach it. Scoped to the sidebar on purpose: Tab is how you
  // move between fields, and hijacking it everywhere would throw you out of a
  // half-filled form.
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

  const sectionLink = (s: Section) => (
    <NavLink
      key={s.to}
      to={s.to}
      end={s.end}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
    >
      <span className="nav-label">{s.label}</span>
      {badgeFor(s) > 0 && (
        <span className="nav-badge" aria-label={`${badgeFor(s)} waiting on you`}>
          {badgeFor(s)}
        </span>
      )}
    </NavLink>
  );
  const group = (f: Floor) => (
    <div key={f.num} className={`ch-group${f === floor ? " is-open" : ""}`} role="group" aria-label={f.name}>
      {/* The group is named by aria-label; this is its visible heading. */}
      <div className="ch-group-name" aria-hidden>
        {f.name}
      </div>
      {f.sections.map(sectionLink)}
    </div>
  );

  return (
    <div className="app-shell ch-app" ref={shell}>
      <header className="topbar ch-bench" ref={frame}>
        <button
          type="button"
          className="ch-ibtn ch-burger"
          aria-label="All sections"
          onClick={() => setDirOpen(true)}
        >
          <Menu size={20} aria-hidden />
        </button>
        <Link to="/" className="ch-lock" aria-label="InventDB Legal, go to Reception">
          <BrandLockup />
        </Link>
        <GlobalSearch />
        <span className="ch-spacer" />
        <button
          type="button"
          className="ch-ibtn m-only"
          aria-label="Search the whole firm"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={18} />
        </button>
        <Link
          to="/workflows"
          className="ch-ibtn ch-bell"
          aria-label={waiting ? `Notifications, ${waiting} waiting on you` : "Notifications"}
          title={waiting ? `${waiting} waiting on you` : "Nothing is waiting on you"}
        >
          <Bell size={18} />
          {waiting > 0 && <span className="ch-dot">{waiting}</span>}
        </Link>
        <button
          type="button"
          className="ch-ibtn d-only"
          onClick={toggle}
          aria-label="Toggle theme"
          title={theme === "dark" ? "Day" : "Night"}
        >
          {theme === "dark" ? <Sun key="sun" size={18} /> : <Moon key="moon" size={18} />}
        </button>
        <Link to="/settings" className="ch-ibtn d-only" aria-label="Settings" title="Settings">
          <SettingsIcon size={18} />
        </Link>
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

      <div className="ch-body">
        <aside className="ch-side">
          <nav
            className="nav"
            aria-label="Sections"
            onKeyDown={(e) => {
              if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
              const at = SECTIONS.findIndex(
                (s) => s.to === (document.activeElement as HTMLAnchorElement)?.getAttribute("href")
              );
              if (at === -1) return;
              const next = at + (e.shiftKey ? -1 : 1);
              // Off either end of the firm: let Tab do its ordinary job.
              if (next < 0 || next >= SECTIONS.length) return;
              e.preventDefault();
              const to = SECTIONS[next].to;
              pendingFocus.current = to;
              document.querySelector<HTMLAnchorElement>(`nav.nav a.nav-item[href="${to}"]`)?.focus();
              navigate(to);
            }}
          >
            <div className="ch-groups">{FLOORS.filter((f) => !f.back).map(group)}</div>
            <div className="ch-groups ch-back">{FLOORS.filter((f) => f.back).map(group)}</div>
          </nav>
        </aside>

        <div className="ch-main">
          {/* Under 1000px the sidebar steps aside and the open group's sections
              ride above the page instead. */}
          <nav className="ch-sub" aria-label={`Sections in ${floor.name}`}>
            <span className="ch-sub-group">{floor.name}</span>
            {floor.sections.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                end={s.end}
                className={({ isActive }) => `ch-sub-item${isActive ? " active" : ""}`}
              >
                {s.label}
                {badgeFor(s) > 0 && <span className="ch-badge">{badgeFor(s)}</span>}
              </NavLink>
            ))}
          </nav>

          {/* The route key drives the page transition: a new pathname remounts
              the subtree, so the entrance animations in global.css replay. */}
          <main className="page" key={location.pathname}>
            <div className="ch-stage" ref={stage}>
              <h1>{title}</h1>
            </div>
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="ch-tabbar" aria-label="Main">
        {BOTTOM.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="ch-tab-item">
            <Icon size={20} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="ch-tab-item"
          aria-current={dirOpen || !BOTTOM.some((b) => b.to === here) ? "page" : undefined}
          aria-label={`All sections${waiting ? `, ${waiting} waiting on you` : ""}`}
          onClick={() => setDirOpen(true)}
        >
          <LayoutGrid size={20} aria-hidden />
          <span>More</span>
          {waiting > 0 && <span className="ch-badge">{waiting}</span>}
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
    <div className="ch-wrap" ref={box}>
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
        <div className="ch-pop ch-menu" role="menu">
          <div className="ch-who">
            Signed in as
            <b>{name}</b>
          </div>
          <button type="button" role="menuitem" onClick={run(onDirectory)}>
            All sections
          </button>
          <button type="button" role="menuitem" onClick={run(onTheme)}>
            {theme === "dark" ? "Switch to day" : "Switch to night"}
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

/** Every section of the app, group by group, on one sheet. */
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
      <div className="ch-scrim" onMouseDown={onClose} />
      <aside className="ch-sheet ch-dir" role="dialog" aria-modal="true" aria-label="All sections">
        <div className="ch-sheet-head">
          <div>
            <div className="k">InventDB Legal</div>
            <h2>All sections</h2>
          </div>
          <button type="button" className="ch-ibtn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="ch-sheet-body">
          <label className="ch-find">
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
            <section key={f.num} className="ch-dir-group" aria-label={f.name}>
              <div className="ch-dir-head">
                <b>{f.name}</b>
                <span className="n">{sections.length}</span>
              </div>
              {sections.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="ch-dir-row"
                  aria-current={s.to === here ? "page" : undefined}
                  aria-label={badgeFor(s) > 0 ? `${s.label}, ${badgeFor(s)} waiting on you` : undefined}
                  onClick={onClose}
                >
                  <span>{s.label}</span>
                  <span className="ch-dir-meta">
                    {badgeFor(s) > 0 && <span className="ch-badge">{badgeFor(s)} waiting</span>}
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
    <div className="ch-msearch" role="dialog" aria-modal="true" aria-label="Search the whole firm">
      <div className="ch-msearch-bar">
        <button type="button" className="ch-ibtn" aria-label="Close search" onClick={onClose}>
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
      <div className="ch-msearch-list" role="listbox" aria-label="Search results">
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
