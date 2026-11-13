import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ArrowRight, ExternalLink, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { BrandLockup } from "../components/BrandLockup";
import { Alert } from "../components/ui";
import { FLOORS } from "../config/floors";
import { useTheme } from "../theme/ThemeContext";

// InventDB is the identity provider, so new users register their workspace
// there rather than in this app.
const INVENTDB_URL = "https://www.inventdb.com";

/**
 * The sign-in page, in the Chambers style: the oxblood bench across the top,
 * the headline and what the firm holds on the left, and the sign-in card on
 * the right. On a phone it stacks — headline, card, then the list — so the
 * form is on the first screen.
 */
export default function Login() {
  const { user, token, login, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggle } = useTheme();

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
    <div className="ch-login">
      <header className="ch-login-bar">
        <BrandLockup className="ch-login-lockup" />
        <button
          type="button"
          className="ch-ibtn"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Day" : "Night"}
        >
          {theme === "dark" ? <Sun key="sun" size={18} /> : <Moon key="moon" size={18} />}
        </button>
      </header>

      <main className="ch-login-main">
        <div className="ch-login-intro">
          <div className="ch-overline">Legal practice management</div>
          <h1>
            Legal practice, <em>modernised.</em>
          </h1>
          <p>
            Every part of the practice under one roof: matters, deadlines, time, billing and client
            trust money. Built on the InventDB SOAR database.
          </p>
        </div>

        <section className="ch-signin" aria-labelledby="signin-title">
          <h2 id="signin-title">Welcome back</h2>
          <p className="lead">Sign in with your InventDB credentials.</p>
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
            <button className="btn btn-primary ls-submit" type="submit" disabled={loading}>
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
          <p className="login-meta">
            No workspace yet?{" "}
            <a href={INVENTDB_URL} target="_blank" rel="noreferrer noopener">
              Register on InventDB
              <ExternalLink size={12} />
            </a>
          </p>
        </section>

        <section className="ch-login-firm" aria-label="Inside the firm">
          <h2 className="ch-overline">Inside the firm</h2>
          <ol>
            {FLOORS.map((f) => (
              <li key={f.num} data-floor={f.sections[0].to.slice(1) || "dashboard"}>
                <span className="ch-date code">
                  <span className="d">{f.num}</span>
                </span>
                <span>
                  <b>{f.name}</b>
                  <span>{f.sections.map((s) => s.label).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="ch-login-foot">
        <span>InventDB Legal</span>
        <span>{"Powered by InventDB SOAR — secure & real-time"}</span>
        <span>Authentication is handled directly by InventDB</span>
      </footer>
    </div>
  );
}
