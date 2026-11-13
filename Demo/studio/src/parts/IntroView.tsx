// The sign-in opening, replayed at true speed from the frames
// capture/intro.capture.ts took at a tenth of it.
import { Img, staticFile } from "remotion";

import manifest from "../../public/intro/frames.json";

type Frame = { file: string; t: number };
const FRAMES = manifest.frames as Frame[];
export const MARKS = manifest.marks as { form: number; submit: number; end: number };

/** The last frame captured at or before `ms` on the page's clock. */
function frameAt(ms: number): Frame {
  let lo = 0;
  let hi = FRAMES.length - 1;
  if (ms <= FRAMES[0].t) return FRAMES[0];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (FRAMES[mid].t <= ms) lo = mid;
    else hi = mid - 1;
  }
  return FRAMES[lo];
}

export function IntroView({ ms }: { ms: number }) {
  const f = frameAt(ms);
  return (
    <Img
      src={staticFile(`intro/${f.file}`)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
