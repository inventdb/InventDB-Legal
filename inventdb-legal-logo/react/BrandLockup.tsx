import { BrandMark } from "./BrandMark";

/**
 * Mark + wordmark + expanded product name. The wordmark is Cormorant Garamond
 * (500, with "Legal" in italic 300); the tagline is the app's sans, all caps,
 * tracked 0.28em. Colours come from theme tokens, so the lockup follows
 * light/dark — except on the brand gradient, where it goes monochrome light.
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
