import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, ExternalLink, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { BrandLockup } from "../components/BrandLockup";
import { FIRM_FEATURES, FirmScene } from "../components/FirmScene";
import { Alert } from "../components/ui";
import { useTheme } from "../theme/ThemeContext";

// InventDB is the identity provider, so new users register their workspace
// there rather than in this app.
const INVENTDB_URL = "https://www.inventdb.com";

/**
 * The login page: one full-screen scene of the firm — by day in light mode,
 * by night in dark — with the practice on its floors. The building draws itself, the floors light from the lobby
 * up, and a line runs out of the lobby to the sign-in sheet, which arrives
 * last. Layout and timing are in the Login block of global.css.
 */
export default function Login() {
  const { user, token, login, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  // Depth: the pointer's position, as -1…1 on each axis, drives the drawing's
  // parallax layers (see `.firm .px` in firm.css). Skipped for reduced motion
  // and for touch, where there is no pointer to follow.
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia?.("(pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--px", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

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

  return (
    <div className="login-page" ref={pageRef}>
      {/* Light mode draws the firm by day, dark mode by night. */}
      <div className="login-scene">
        <FirmScene variant="hero" sky={theme === "dark" ? "evening" : "afternoon"} />
      </div>

      <button
        type="button"
        className="login-theme"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
      >
        {theme === "dark" ? <Sun key="sun" size={17} /> : <Moon key="moon" size={17} />}
      </button>

      <header className="login-hero">
        <BrandLockup className="hero-badge" size="lg" />
        <div className="login-story">
          {/* Two deliberate lines on desktop; one line on a phone. */}
          <h1>
            <span>Legal practice,</span> <span>modernised.</span>
          </h1>
          <p>
            Every part of the practice, under one roof — built on the InventDB SOAR
            database.
          </p>
          {/* The drawing is decorative to assistive tech, so what each floor
              does is listed here instead. */}
          <ul className="sr-only">
            {FIRM_FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </header>

      <section className="login-form-wrap" aria-label="Sign in">
        <div className="login-sheet">
          <div className="ls-annot">
            <span>G</span> Reception
          </div>
          <div className="lc-head">
            <h2>Welcome back</h2>
            <p>Sign in with your InventDB credentials.</p>
          </div>
          <form onSubmit={onSubmit}>
            {error && <Alert kind="error">{error}</Alert>}
            <div className="ls-field">
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
            <div className="ls-field">
              <label htmlFor="password">Password</label>
              <div className="ls-pass">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="ls-toggle"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button className="ls-submit" type="submit" disabled={loading}>
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
          <div className="login-meta">
            No workspace yet?{" "}
            <a href={INVENTDB_URL} target="_blank" rel="noreferrer noopener">
              Register on InventDB
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </section>

      <footer className="hero-foot">
        <span>InventDB Legal</span>
        <span>{"Powered by InventDB SOAR — secure & real-time"}</span>
        <span>Authentication is handled directly by InventDB</span>
      </footer>
    </div>
  );
}
