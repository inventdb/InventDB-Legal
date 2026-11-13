// One captured screen, seen through a moving camera. The camera only ever
// moves; it never fades. Highlights are drawn on as gold outlines.
import { Easing, Img, interpolate, staticFile } from "remotion";

import type { Cam, Mark } from "../timeline";
import { EASE, C } from "../theme";

const PAGE_W = 1600;
const PAGE_H = 900;
const ease = Easing.bezier(...EASE);

/** The 16:9 region the camera shows at progress u (0..1). */
export function cameraAt(cam: Cam[] | undefined, u: number) {
  const keys = cam && cam.length ? cam : [[0, 0, 0, PAGE_W] as Cam];
  let [, x, y, w] = keys[0];
  if (u >= keys[keys.length - 1][0]) [, x, y, w] = keys[keys.length - 1];
  else {
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (u >= a[0] && u <= b[0]) {
        const k = b[0] === a[0] ? 1 : ease((u - a[0]) / (b[0] - a[0]));
        x = a[1] + (b[1] - a[1]) * k;
        y = a[2] + (b[2] - a[2]) * k;
        w = a[3] + (b[3] - a[3]) * k;
        break;
      }
    }
  }
  // A slow push-in across the whole shot keeps a held frame alive.
  const drift = 1 - 0.025 * u;
  const cx = x + w / 2;
  const cy = y + (w * 9) / 32;
  w = Math.max(420, Math.min(PAGE_W, w * drift));
  const h = (w * 9) / 16;
  x = Math.max(0, Math.min(PAGE_W - w, cx - w / 2));
  y = Math.max(0, Math.min(PAGE_H - h, cy - h / 2));
  return { x, y, w, h };
}

export function ShotView({
  src,
  cam,
  marks,
  width,
  height,
  frame,
  frames,
}: {
  src: string;
  cam?: Cam[];
  marks?: Mark[];
  width: number;
  height: number;
  frame: number;
  frames: number;
}) {
  const u = Math.max(0, Math.min(1, frame / frames));
  const r = cameraAt(cam, u);
  const s = width / r.w;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.bg }}>
      <Img
        src={staticFile(`shots/${src}.jpg`)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: PAGE_W * s,
          height: PAGE_H * s,
          transform: `translate(${-r.x * s}px, ${-r.y * s}px)`,
          transformOrigin: "0 0",
        }}
      />
      {(marks ?? []).map(([at, mx, my, mw, mh], i) => {
        const start = at * frames;
        const p = interpolate(frame, [start, start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
        if (p <= 0) return null;
        const pad = 6;
        const x = (mx - pad - r.x) * s;
        const y = (my - pad - r.y) * s;
        const w = (mw + pad * 2) * s;
        const h = (mh + pad * 2) * s;
        const rad = 10;
        const len = 2 * (w + h);
        return (
          <svg key={i} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={width} height={height}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={rad}
              fill="none"
              stroke={C.gold}
              strokeWidth={3.5}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - p)}
            />
          </svg>
        );
      })}
    </div>
  );
}
