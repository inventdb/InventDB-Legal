import { BrandMark } from "./BrandMark";

/**
 * The full brand lockup — Counsel mark, wordmark, and the expanded product
 * name — following inventdb-legal-logo/lockup/lockup-horizontal-*.svg.
 *
 * The asset sets the wordmark in Cormorant Garamond 500 with "Legal" in
 * italic 300, a hairline rule beneath it, and an all-caps Poppins tagline
 * under that. Those relationships are kept and scaled down for in-app use;
 * the colours come from theme tokens instead of the asset's own hexes so the
 * lockup follows light/dark. The one exception is the login hero, where the
 * lockup sits on the brand gradient and a purple accent would vanish — that is
 * the asset's "reversed" cut, and the `.login-hero` overrides in global.css.
 *
 * `tile` wraps the mark in the gradient chip used in the sidebar; without it
 * the mark is bare and inherits its colour, as it does on the hero.
 */
export function BrandLockup({
  size = "sm",
  tile = false,
  className = "",
}: {
  size?: "sm" | "lg";
  tile?: boolean;
  className?: string;
}) {
  // Both sizes stay above the package's 20px threshold, so the lockup always
  // carries the full cut; the solid cut is for the favicon and dense chrome.
  const markSize = size === "lg" ? 34 : 21;
  const mark = <BrandMark size={markSize} title={tile ? undefined : "InventDB Legal"} />;

  return (
    <div className={`brand-lockup brand-lockup--${size} ${className}`.trim()}>
      {tile ? <span className="logo">{mark}</span> : mark}
      <span className="brand-lockup-text">
        <span className="brand-lockup-name">
          InventDB<span className="brand-lockup-suffix">Legal</span>
        </span>
        <span className="brand-lockup-tag">Legal Practice Management</span>
      </span>
    </div>
  );
}

export default BrandLockup;
