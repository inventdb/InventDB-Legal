// The sign-in opening, as motion. The page's animations are slowed tenfold
// through the DevTools protocol and screenshotted as fast as possible; each
// frame is stamped with its time on the page's own clock, so the film can
// replay the sequence at true speed, frame-accurately and without a video
// codec's blur. Typing is captured one keystroke per frame on a synthetic
// clock instead, since keystrokes are not animations.
import fs from "node:fs";
import path from "node:path";
import type { CDPSession, Page } from "@playwright/test";

import { PERSON, SHOTS, prepare, test } from "./lib";

const OUT = path.resolve(SHOTS, "../intro");
const RATE = 0.1;

test.use({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });

type Frame = { file: string; t: number };

async function record(page: Page, frames: Frame[], offset: number, until: () => Promise<boolean>, tail = 900) {
  const start = Date.now();
  let doneAt: number | null = null;
  for (;;) {
    const t = offset + (Date.now() - start) * RATE;
    const file = `f${String(frames.length).padStart(4, "0")}.jpg`;
    await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 90 });
    frames.push({ file, t: Math.round(t) });
    if (doneAt === null && (await until())) doneAt = t;
    if (doneAt !== null && t - doneAt > tail) return t;
    if (t - offset > 20000) throw new Error("sequence did not finish");
  }
}

test("intro", async ({ page }) => {
  test.setTimeout(600_000);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  await prepare(page, { signedIn: false });

  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: RATE });

  const frames: Frame[] = [];
  const marks: Record<string, number> = {};
  await page.goto("/login");

  // 1. The opening, until the sign-in form is on screen.
  const user = page.getByLabel("Username", { exact: true });
  const opening = page.locator(".dk-intro");
  let t = await record(page, frames, 0, async () => (await opening.count()) === 0 && (await user.isVisible()), 1400);
  marks.form = t;

  // 2. Typing, one keystroke per frame at a natural pace.
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
  const typeInto = async (label: string, text: string, ms: number) => {
    await page.getByLabel(label, { exact: true }).click();
    t += 250;
    for (const ch of text) {
      await page.keyboard.type(ch);
      t += ms;
      const file = `f${String(frames.length).padStart(4, "0")}.jpg`;
      await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 90 });
      frames.push({ file, t: Math.round(t) });
    }
  };
  await typeInto("Username", PERSON.username, 95);
  // The mock API's test password (e2e fixtures); it never leaves this browser.
  await typeInto("Password", "correct-horse", 70);
  t += 450;
  marks.submit = t;

  // 3. Sign in, and whatever the app does on the way to the dashboard.
  await cdp.send("Animation.setPlaybackRate", { playbackRate: RATE });
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  const heading = page.getByRole("heading", { level: 1 });
  t = await record(page, frames, t, async () => (await page.url()).endsWith("/") && (await heading.isVisible().catch(() => false)), 1600);
  marks.end = t;

  fs.writeFileSync(path.join(OUT, "frames.json"), JSON.stringify({ rate: RATE, marks, frames }, null, 0));
  console.log(`intro: ${frames.length} frames over ${(t / 1000).toFixed(1)}s`, marks);
});
