import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, ExternalLink, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { BrandLockup } from "../components/BrandLockup";
import { DeskIntro } from "../components/DeskIntro";
import { DeskBook } from "../components/DeskBook";
import { Alert } from "../components/ui";
import { useTheme } from "../theme/ThemeContext";

// InventDB is the identity provider, so new users register their workspace
// there rather than in this app.
const INVENTDB_URL = "https://www.inventdb.com";

const WALKIN_KEY = "legal.desk.walkin";
/** The walk-in plays once per device, for someone new, and never with reduced motion. */
function firstVisit(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return localStorage.getItem(WALKIN_KEY) !== "1" && localStorage.getItem("legal.desk.seen") !== "1";
  } catch {
    return false;
  }
}
function markWalkIn() {
  try {
    localStorage.setItem(WALKIN_KEY, "1");
  } catch {
    /* a private window: it plays again next time */
  }
}

/** True on a phone, where the booklet turns one page at a time. */
function useNarrow(): boolean {
  const query = "(max-width: 760px)";
  const [narrow, setNarrow] = useState(() => !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return narrow;
}

/**
 * The sign-in page: the firm's guide, a leather booklet, open in the middle of
 * the page. It turns its own pages and ends with signing in on the left page
 * and signing up on the right. A first visit opens with the walk-in through
 * the firm (DeskIntro). See DeskBook for how the pages turn, and
 * styles/desk.css for the look.
 */
export default function Login() {
  const { user, token, login, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggle } = useTheme();
  const narrow = useNarrow();
  // A first visit opens with the walk-in; never with reduced motion, and
  // never for someone who has already read the booklet.
  const [intro, setIntro] = useState(firstVisit);
  const [skipped, setSkipped] = useState(false);

  if (user && token) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const signIn = (
    <div className="dk-signin">
      <div className="dk-chapter">Sign in</div>
      <h2>Welcome back</h2>
      <p className="dk-lead">Sign in with your InventDB credentials.</p>
      <form onSubmit={onSubmit}>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="dk-field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your.username"
            required
          />
        </div>
        <div className="dk-field">
          <label htmlFor="password">Password</label>
          <div className="dk-pass">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button className="dk-btn solid dk-submit" type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={16} className="spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={16} aria-hidden />
            </>
          )}
        </button>
      </form>
    </div>
  );

  const signUp = (
    <div className="dk-signup">
      <div className="dk-chapter">Sign up</div>
      <h3>New to InventDB Legal?</h3>
      <p className="dk-lead">
        Your firm's workspace is created on InventDB, the database the app runs on. Register there,
        then come back here and sign in.
      </p>
      <ul className="dk-points">
        <li>One workspace for the whole firm</li>
        <li>Your InventDB username and password sign you in here</li>
        <li>Authentication is handled directly by InventDB</li>
      </ul>
      <div className="dk-actions">
        <a className="dk-btn" href={INVENTDB_URL} target="_blank" rel="noreferrer noopener">
          Register on InventDB
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );

  return (
    <div className={`dk-room${narrow ? " is-narrow" : ""}`}>
      <header className="dk-top">
        <BrandLockup />
        <button
          type="button"
          className="dk-theme"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Day" : "Night"}
        >
          {theme === "dark" ? <Sun key="sun" size={17} /> : <Moon key="moon" size={17} />}
        </button>
      </header>

      {/* The headline is set on the booklet's title page; this is the page's own heading. */}
      <h1 className="sr-only">Legal practice, modernised.</h1>

      <DeskBook narrow={narrow} signIn={signIn} signUp={signUp} hold={intro} skipToSignIn={skipped} />
      {intro && (
        <DeskIntro
          narrow={narrow}
          onDone={(skip) => {
            markWalkIn();
            setIntro(false);
            if (skip) setSkipped(true);
          }}
        />
      )}

      <footer className="dk-foot">
        <span>InventDB Legal</span>
        <span>{"Powered by InventDB SOAR — secure & real-time"}</span>
        <span>Authentication is handled directly by InventDB</span>
      </footer>
    </div>
  );
}
