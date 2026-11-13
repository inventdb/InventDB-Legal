// Writes the .srt subtitle files next to the films, from the same timeline the
// films burn their captions from, and checks that every caption can be read
// in the time it is on screen.
//
//   node scripts/subtitles.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { layout } from "../src/timeline.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../..");
const MAX_CPS = 17; // characters per second, the usual ceiling for subtitles

function stamp(s: number) {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(r, 3)}`;
}

let problems = 0;
for (const [cut, name, expect] of [
  ["short", "InventDB-Legal-Demo-3min", 180],
  ["long", "InventDB-Legal-Demo-5min", 300],
] as const) {
  const { caps, total } = layout(cut);
  if (Math.abs(total - expect) > 0.01) {
    console.log(`${name}: runs ${total}s, expected ${expect}s`);
    problems++;
  }
  const srt = caps
    .map((c, i) => {
      const cps = c.text.length / (c.end - c.start);
      if (cps > MAX_CPS) {
        console.log(`${name}: ${cps.toFixed(1)} cps  "${c.text}"`);
        problems++;
      }
      // Subtitles leave the screen a beat before the next arrives.
      return `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end - 0.08)}\n${c.text}\n`;
    })
    .join("\n");
  fs.writeFileSync(path.join(OUT, `${name}.srt`), srt, "utf-8");
  console.log(`${name}.srt: ${caps.length} captions, ${total}s`);
}
process.exit(problems ? 1 : 0);
