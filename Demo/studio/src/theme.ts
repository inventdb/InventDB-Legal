// The app's light-theme tokens (frontend/src/styles/global.css).
export const C = {
  brand: "#5b1a24",
  brandStrong: "#47141c",
  gold: "#a8823a",
  goldSoft: "#f4ead3",
  bg: "#f4ede1",
  surface: "#fffdf9",
  surface2: "#f8f2e8",
  line: "#e2d6c3",
  ink: "#1c1916",
  muted: "#4a4239",
  faint: "#675c50",
};

export const W = 1920;
export const H = 1080;
export const FPS = 30;

/** Where app footage sits when it is framed: a window with a title bar. */
export const FRAME = { x: 190, y: 22, w: 1540, title: 40 };
export const CONTENT_H = (FRAME.w * 9) / 16;

/** The ease every move uses: quick to start, long settle. */
export const EASE = [0.45, 0, 0.2, 1] as const;
