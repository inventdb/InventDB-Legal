import { useMemo } from "react";

import { useTheme, type Theme } from "./ThemeContext";

/**
 * Chart colours for the Chambers theme (oxblood · parchment · brass).
 *
 * Recharts writes colours into SVG attributes and into its own legend/tooltip
 * markup, so charts need concrete values rather than `var(--chart-1)`. These
 * arrays are the JS mirror of the `--chart-*` tokens in `styles/global.css` —
 * keep the two in step.
 *
 * The palette is CATEGORICAL: it encodes which series a mark belongs to, never
 * how large it is. Slots are handed out in fixed order and never cycled, so a
 * category keeps its colour when the series count changes. The order keeps
 * neighbouring slots apart for red-green colour vision; the figures are in the
 * palette note at the foot of global.css.
 *
 *  - Every slot holds 3:1 or better against the chart's surface in both
 *    modes, and every chart here still ships a legend plus direct labels or
 *    the same figures in a table.
 *  - Forms where any two marks can touch (scatter, bubble) are capped at
 *    `SCATTER_MAX_SERIES` slots, the set that clears the all-pairs gate.
 */
const SERIES: Record<Theme, readonly string[]> = {
  light: [
    "#5b1a24", // oxblood
    "#a8823a", // brass
    "#235a8a", // blue ink
    "#2f6b4f", // trust green
    "#5a3f86", // violet
    "#a3505e", // rose
    "#4f7a8a", // slate teal
    "#8f8270", // stone
  ],
  dark: [
    "#e6a7b0",
    "#d9b871",
    "#8fbbe3",
    "#86c9a8",
    "#bba6e6",
    "#d98a97",
    "#7fb3c0",
    "#c3b6a4",
  ],
};

/** Everything past the last slot folds into one neutral "Other". */
const OTHER: Record<Theme, string> = { light: "#675c50", dark: "#9d907f" };

/**
 * Axis ink, gridlines and the hover cursor wash, per mode. Axis ticks are
 * text, so they carry the same 4.5:1 bar as captions (--text-faint).
 */
const CHROME: Record<Theme, { axis: string; grid: string; cursor: string }> = {
  light: { axis: "#675c50", grid: "#e6dccb", cursor: "rgba(91,26,36,0.06)" },
  dark: { axis: "#9d907f", grid: "#2c251f", cursor: "rgba(230,167,176,0.10)" },
};

/** Reserved state colours — never reused as a series colour. */
const STATUS: Record<
  Theme,
  { success: string; warn: string; danger: string; neutral: string; brand: string }
> = {
  light: {
    success: "#235a8a",
    warn: "#7a5c22",
    danger: "#b23a12",
    neutral: "#675c50",
    brand: "#5b1a24",
  },
  dark: {
    success: "#8fbbe3",
    warn: "#d9b871",
    danger: "#f2895f",
    neutral: "#9d907f",
    brand: "#e6a7b0",
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
