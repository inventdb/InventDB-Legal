// Render a handful of stills from one bundle, for checking the films by eye.
//   node scripts/stills.mjs LegalDemo5 6 16 23.5 ...   (seconds)
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [id, ...secs] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id, inputProps: {} });
for (const s of secs) {
  const frame = Math.round(Number(s) * composition.fps);
  const output = path.resolve(`out/${id}-${String(s).padStart(5, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, scale: 0.5 });
  console.log(output);
}
