// Shared set-up for the demo recording: the dataset, the clock, the signed-in
// person, and a `shot()` that saves a frame plus where the interesting parts of
// it are, so the film can move its camera to them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

import { ACCESS, test as base } from "../../../frontend/e2e/fixtures";
import { legalise } from "./legal-content";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.resolve(HERE, "../public/shots");
fs.mkdirSync(SHOTS, { recursive: true });

const DATA = path.join(HERE, "data");
const STORE_JSON = fs.readFileSync(path.join(DATA, "store.json"), "utf-8");
export const FIGURES = JSON.parse(fs.readFileSync(path.join(DATA, "figures.json"), "utf-8"));

// The fixture arrays the mock serves were written for a property-management
// sibling app; swap them for a law firm's before any test installs the mock.
legalise();

/** The dataset's as-of date, late afternoon, so "today" agrees with every figure. */
export const NOW = new Date(`${FIGURES.today}T17:40:00Z`);

export const PERSON = {
  id: "u-1",
  username: "m.alvarado",
  email: "m.alvarado@alvaradosung.example",
  role: "manager",
  isActive: true,
};

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  store: async ({}, use) => {
    await use(JSON.parse(STORE_JSON));
  },
});

export async function prepare(
  page: Page,
  opts: { signedIn?: boolean; theme?: "light" | "dark"; access?: keyof typeof ACCESS } = {}
) {
  const { signedIn = true, theme = "light", access = "admin" } = opts;
  // What this tier may read, so the dashboard leaves out what the backend would.
  const can = ACCESS[access].entities as Record<string, string>;
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(
    ({ signedIn, theme, person }) => {
      localStorage.setItem("legal.theme", theme);
      if (signedIn) {
        localStorage.setItem("legal.token", "e2e-test-token");
        localStorage.setItem("legal.user", JSON.stringify(person));
        localStorage.setItem("legal.desk.seen", "1");
      } else {
        localStorage.removeItem("legal.token");
        localStorage.removeItem("legal.user");
        localStorage.removeItem("legal.desk.seen");
      }
    },
    { signedIn, theme, person: PERSON }
  );
  // The suite blanks Google Fonts to stay offline; the film wants the real type.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.continue());

  // Dashboard figures computed from the dataset (build_data.py), served the
  // way backend/app/routers/dashboard.py serves them.
  await page.route(/\/api\/dashboard\/(summary|charts|panels)/, (route) => {
    const url = new URL(route.request().url());
    const part = url.pathname.split("/").pop()!;
    if (part === "summary") {
      const need: Record<string, string[]> = {
        matters: ["matters"], clients: ["clients"], deadlines: ["deadlines_and_sol"], time: ["time_entries"],
        calendar: ["court_calendar"], intake: ["intake_and_leads"],
      };
      const out: Record<string, unknown> = { as_of: FIGURES.summary.as_of };
      for (const [k, ents] of Object.entries(need)) if (ents.every((e) => can[e])) out[k] = { ...FIGURES.summary[k] };
      if (out.time && !can.invoices) delete (out.time as Record<string, unknown>).wip_value;
      const f = FIGURES.summary.financials;
      const money: Record<string, number> = {};
      if (can.invoices) Object.assign(money, { billed_month: f.billed_month, ar_outstanding: f.ar_outstanding });
      if (can.payments_and_receipts) money.collected_month = f.collected_month;
      if (can.trust_ledger_cta) money.trust_balance = f.trust_balance;
      if (Object.keys(money).length) out.financials = money;
      return route.fulfill({ json: out });
    }
    if (part === "charts") {
      const c = FIGURES.charts;
      const out: Record<string, unknown> = {};
      if (can.matters) Object.assign(out, { matter_status: c.matter_status, practice_area: c.practice_area });
      if (can.deadlines_and_sol) Object.assign(out, { deadline_status: c.deadline_status, deadline_priority: c.deadline_priority });
      if (can.costs_and_disbursements) out.cost_breakdown = c.cost_breakdown;
      if (can.invoices && can.payments_and_receipts) Object.assign(out, { ar_aging: c.ar_aging, cashflow: c.cashflow });
      return route.fulfill({ json: out });
    }
    const names = (url.searchParams.get("names") ?? "").split(",").filter(Boolean);
    const out: Record<string, unknown> = {};
    for (const n of names) if (FIGURES.panels[n] && can[FIGURES.panels[n].entity]) out[n] = FIGURES.panels[n];
    return route.fulfill({ json: out });
  });

  // Saved reports render the firm's own tables (build_data.py report_pages).
  await page.route(/\/api\/reports\/templates\/[^/]+\/render/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").slice(-2)[0];
    const html = FIGURES.reports[id];
    if (!html) return route.fallback();
    return route.fulfill({ json: { html, meta: { elapsed_ms: 212, mode: "sql", bytes: html.length } } });
  });
}

type Focus = Record<string, string>;

/**
 * Save `<name>.jpg` and `<name>.json` with the page-space rectangle of each
 * focus selector, so the film can push in on exactly that part of the frame.
 */
export async function shot(page: Page, name: string, focus: Focus = {}, opts: { settle?: number } = {}) {
  await page.waitForTimeout(opts.settle ?? 700);
  await page.evaluate(() => document.fonts?.ready);
  const rects: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const [key, sel] of Object.entries(focus)) {
    const loc = page.locator(sel).first();
    const box = await loc.boundingBox().catch(() => null);
    if (box) rects[key] = { x: box.x, y: box.y, w: box.width, h: box.height };
    else console.log(`[${name}] focus "${key}" not found: ${sel}`);
  }
  const vp = page.viewportSize()!;
  await page.screenshot({ path: path.join(SHOTS, `${name}.jpg`), type: "jpeg", quality: 92 });
  fs.writeFileSync(
    path.join(SHOTS, `${name}.json`),
    JSON.stringify({ width: vp.width, height: vp.height, rects }, null, 1)
  );
}

/** Type like a person, so a sequence of frames reads as typing. */
export async function typeSlowly(page: Page, selector: string, text: string, delay = 35) {
  await page.locator(selector).first().click();
  await page.keyboard.type(text, { delay });
}
