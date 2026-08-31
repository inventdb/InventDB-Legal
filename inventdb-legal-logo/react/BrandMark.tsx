/**
 * InventDB Legal — "Counsel" mark.
 *
 * An advocate whose curved, tapering arms carry the two pans: arm tips land
 * exactly on the pan apexes, bowls filled, outlines in the second tone.
 * Drawn on a 0 0 128 128 grid.
 *
 * Two cuts:
 *   full  — outlined pans + filled bowls; use at 20px and above.
 *   solid — outlines dropped, heavier arms; use below 20px (favicons, dense UI).
 *
 * `tone` defaults to a translucent currentColor so the mark works in one
 * colour anywhere; pass an explicit tone for the two-tone treatment
 * (#a184c4 on light, #7d63a0 on dark, rgba(255,255,255,0.55) on the gradient).
 */
export function BrandMark({
  size = 20,
  tone,
  title,
}: {
  size?: number;
  tone?: string;
  title?: string;
}) {
  const second = tone ?? "currentColor";
  const solid = size < 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      {title && <title>{title}</title>}
      {solid ? (
        <>
          <circle cx="64" cy="27" r="15" fill="currentColor" />
          <path d="M53 38 L75 38 L64 120 Z" fill="currentColor" />
          <path d="M64 46 L16 30 L16 44 L64 62 Z" fill="currentColor" />
          <path d="M64 46 L112 30 L112 44 L64 62 Z" fill="currentColor" />
          <path d="M16 32 L2 76 L30 76 Z" fill={second} />
          <path d="M112 32 L98 76 L126 76 Z" fill={second} />
        </>
      ) : (
        <>
          <circle cx="64" cy="28" r="13.5" fill="currentColor" />
          <path d="M55 41 C57 60 60 86 64 117 C68 86 71 60 73 41 Z" fill="currentColor" />
          <path d="M64 46 C50 44 34 40 22 34 L22 41.5 C36 48.5 52 54 64 57 Z" fill="currentColor" />
          <path d="M64 46 C78 44 94 40 106 34 L106 41.5 C92 48.5 76 54 64 57 Z" fill="currentColor" />
          <path d="M22 35 L8 67 L36 67 Z" fill="none" stroke={second} strokeWidth={5.5} strokeLinejoin="round" />
          <path d="M8 67 A14 14 0 0 0 36 67 Z" fill="currentColor" />
          <path d="M106 35 L92 67 L120 67 Z" fill="none" stroke={second} strokeWidth={5.5} strokeLinejoin="round" />
          <path d="M92 67 A14 14 0 0 0 120 67 Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export default BrandMark;
