import { useMemo } from "react";

import { useTheme, type Theme } from "./ThemeContext";

/**
 * Chart colours for the InventDB Legal theme (Midnight Navy · Powder Blue ·
 * Sunflower Yellow).
 *
 * Recharts writes colours into SVG attributes and into its own legend/tooltip
 * markup, so charts need concrete values rather than `var(--chart-1)`. These
 * arrays are the JS mirror of the `--chart-*` tokens in `styles/global.css` —
 * keep the two in step.
 *
 * The palette is CATEGORICAL: it encodes which series a mark belongs to, never
 * how large it is. Slots are handed out in fixed order and never cycled, so a
 * category keeps its colour when the series count changes. Slot 1 is the brand
 * blue: navy itself is too dark to hold the light-mode lightness band, so the
 * series uses the palette's validated blue, and the purple moved to slot 7.
 * The swap keeps every adjacent pair and the first-three all-pairs gate at the
 * figures recorded at the foot of global.css.
 *
 * Validated in both modes for lightness band, chroma floor, colour-vision
 * separation (Machado 2009 protan/deutan at full severity), a normal-vision
 * floor and contrast against the card surface. Two consequences bind callers:
 *
 *  - In light mode slots 3, 4 and 5 fall below 3:1 on white, which is only
 *    legal alongside a relief channel. Every chart here ships a legend plus
 *    direct labels or the same figures in a table.
 *  - Forms where any two marks can touch (scatter, bubble) are capped at
 *    `SCATTER_MAX_SERIES` slots, the set that clears the harder all-pairs gate.
 */
const SERIES: Record<Theme, readonly string[]> = {
  light: [
    "#2a78d6", // brand blue
    "#eb6834", // orange
    "#1baf7a", // aqua
    "#eda100", // yellow
    "#e87ba4", // magenta
    "#008300", // green
    "#6d25a2", // purple
    "#e34948", // red
  ],
  dark: [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#a67ce0",
    "#e66767",
  ],
};

/** Everything past the last slot folds into one neutral "Other". */
const OTHER: Record<Theme, string> = { light: "#586a84", dark: "#9fb6d3" };

/**
 * Axis ink, gridlines and the hover cursor wash, per mode. Axis ticks are
 * text, so they carry the same 4.5:1 bar as captions (--text-faint).
 */
const CHROME: Record<Theme, { axis: string; grid: string; cursor: string }> = {
  light: { axis: "#586a84", grid: "#e8eff6", cursor: "rgba(31,74,133,0.06)" },
  dark: { axis: "#879ebd", grid: "#1e3152", cursor: "rgba(185,214,238,0.10)" },
};

/** Reserved state colours — never reused as a series colour. */
const STATUS: Record<
  Theme,
  { success: string; warn: string; danger: string; neutral: string; brand: string }
> = {
  light: {
    success: "#1d7a4b",
    warn: "#7a5a00",
    danger: "#b3261e",
    neutral: "#586a84",
    brand: "#1f4a85",
  },
  dark: {
    success: "#5cc492",
    warn: "#ffd66b",
    danger: "#f08a84",
    neutral: "#9fb6d3",
    brand: "#b9d6ee",
  },
};

/** Slots that clear the all-pairs separation gate, for scatter/bubble charts. */
export const SCATTER_MAX_SERIES = 3;

/** Slots available to bar/line/area/pie before folding into "Other". */
export const MAX_SERIES = SERIES.light.length;

export interface ChartTheme {
  /** Categorical slots, in fixed assignment order. */
  series: readonly string[];
  /** Colour for the "Other" bucket and for anything past the last slot. */
  other: string;
  axis: string;
  grid: string;
  /** Fill for the bar/area hover cursor. */
  cursor: string;
  status: (typeof STATUS)[Theme];
  /** Slot `i`, clamped to "Other" rather than wrapping around the palette. */
  seriesAt: (i: number) => string;
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();

  return useMemo<ChartTheme>(() => {
    const series = SERIES[theme];
    const other = OTHER[theme];
    return {
      series,
      other,
      ...CHROME[theme],
      status: STATUS[theme],
      seriesAt: (i: number) => (i >= 0 && i < series.length ? series[i] : other),
    };
  }, [theme]);
}

/** Maps a work-order / run status onto its reserved state colour. */
export function statusColor(status: string, t: ChartTheme): string {
  const s = status.toLowerCase();
  if (s === "succeeded" || s === "success" || s === "completed") return t.status.success;
  if (s === "failed" || s === "error") return t.status.danger;
  if (s === "running" || s === "parked" || s === "in_progress") return t.status.warn;
  return t.status.neutral;
}

/**
 * Caps a categorical breakdown at `max` slices, merging the tail into a single
 * "Other" row. Keeps the palette from cycling — an unbounded category list
 * would otherwise reuse slot 1 for the ninth item and imply a relationship
 * that isn't there.
 */
export function foldToOther<T extends { name?: string; value?: number }>(
  data: readonly T[] | undefined,
  max: number = MAX_SERIES,
): Array<{ name: string; value: number }> {
  const rows = (data ?? [])
    .map((d) => ({ name: String(d.name ?? "—"), value: Number(d.value ?? 0) }))
    .sort((a, b) => b.value - a.value);

  if (rows.length <= max) return rows;

  const head = rows.slice(0, max - 1);
  const tail = rows.slice(max - 1);
  head.push({
    name: `Other (${tail.length})`,
    value: tail.reduce((sum, r) => sum + r.value, 0),
  });
  return head;
}
