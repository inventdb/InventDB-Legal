# InventDB Legal — "Counsel" logo

An advocate whose curved, tapering arms carry the two pans of the balance.
Everything is drawn on one `0 0 128 128` grid.

## Colourways

| Primary | Second tone | Use |
|---|---|---|
| `#48176a` Orbital Indigo | `#a184c4` | light surfaces (default) |
| `#c696e8` Wisteria Bloom | `#7d63a0` | dark theme |
| `#ffffff` | `rgba(255,255,255,.55)` | brand gradient, login hero |
| `#2a1035` | same | one-colour / print / fax |

## Two cuts

- **Full** (`mark/counsel-*.svg`) — outlined pans, filled bowls. **20px and above.**
- **Solid** (`mark/counsel-small-*.svg`) — outlines dropped, heavier arms. **Below 20px**: favicon, tab strips, dense tables.

## Files

```
mark/       full + solid cuts in every colourway, incl. currentColor
lockup/     horizontal lockup, light / dark / reversed on plum
favicon/    favicon.svg (plum tile), favicon-transparent.svg, apple-touch-icon.svg
react/      BrandMark.tsx, BrandLockup.tsx — drop-in replacements
```

## Clear space & minimum size

Clear space on all sides = the head's diameter (27 units, ~21% of the mark's
width). Minimum size 16px for the solid cut; do not use the full cut below 20px.

## Wordmark

Cormorant Garamond 500, "Legal" in italic 300. Tagline in the app sans
(Poppins), all caps, 0.28em tracking, at ~0.28x the wordmark size. The lockup
SVGs use live text — convert to outlines before sending to a printer, or keep
the fonts installed.

## Notes

- The React components take colour from `currentColor`, so they inherit
  `--brand` / `--on-brand` exactly like the previous mark. Pass `tone` for
  the explicit two-tone treatment.
- `BrandMark` switches to the solid cut automatically below 20px.
