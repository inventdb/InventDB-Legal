/**
 * Shown after sign-in to someone InventDB knows but who has no Legal role yet.
 *
 * It says only that the account is not set up and who can fix it. It does not
 * list roles, tiers or what any of them would see. Also covers the case where
 * the access check itself failed, with a retry.
 *
 * Structure for styling (chambers.css): `.ch-notsetup` wraps a `.ch-notsetup-card`
 * holding `h1`, `p` and `.ch-notsetup-actions`.
 */
import { BrandLockup } from "../components/BrandLockup";
import { useAuth } from "../auth/AuthContext";

export default function NotSetUp({ error }: { error?: string | null }) {
  const { user, logout, reloadAccess } = useAuth();
  const who = String(user?.username ?? "");

  return (
    <main className="ch-notsetup" aria-labelledby="notsetup-title">
      <div className="ch-notsetup-card card">
        <BrandLockup />
        {error ? (
          <>
            <h1 id="notsetup-title">We couldn't open your workspace</h1>
            <p>{error}</p>
          </>
        ) : (
          <>
            <h1 id="notsetup-title">Your account isn't set up for InventDB Legal yet</h1>
            <p>
              You're signed in{who ? <> as <b>{who}</b></> : null}, but this account hasn't been
              given access to the practice. Ask your firm's administrator to set it up, then sign
              in again.
            </p>
          </>
        )}
        <div className="ch-notsetup-actions">
          <button type="button" className="btn btn-primary" onClick={reloadAccess}>
            Try again
          </button>
          <button type="button" className="btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
