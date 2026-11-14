// The evidence a law firm looks for: a deadline's rule and computation, a
// lead's limitation date, UTBMS-coded time, an invoice paid partly from
// trust, a settlement's liens, a matter's own trust ledger, and the trust and
// receivables reports. Every record named here is in the demo dataset.
import type { Page } from "@playwright/test";

import { prepare, shot, test } from "./lib";

/** Open a record from its module's table, by its number. */
async function openRecord(page: Page, route: string, placeholder: RegExp, id: string) {
  await page.goto(`${route}?view=table`);
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder(placeholder).fill(id);
  await page.waitForTimeout(900);
  await page.locator("table tbody tr").filter({ hasText: id }).first().click();
  await page.waitForTimeout(1400);
}

test("deadline", async ({ page }) => {
  await prepare(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByText("Designation of the record on appeal").first().click();
  await shot(page, "dl-1", {}, { settle: 1600 });
});

test("lead", async ({ page }) => {
  await prepare(page);
  await openRecord(page, "/intake_and_leads", /Search intake/i, "LD-3582");
  await shot(page, "lead-1", {}, { settle: 600 });
});

test("time entry", async ({ page }) => {
  await prepare(page);
  await openRecord(page, "/time_entries", /Search time/i, "TE-133670");
  await shot(page, "te-1", {}, { settle: 600 });
});

test("invoice", async ({ page }) => {
  await prepare(page);
  await openRecord(page, "/invoices", /Search invoices/i, "INV-2026-1744");
  await shot(page, "inv-1", {}, { settle: 600 });
  await page.mouse.move(1200, 500);
  await page.mouse.wheel(0, 500);
  await shot(page, "inv-2", {}, { settle: 800 });
});

test("settlement", async ({ page }) => {
  await prepare(page);
  await openRecord(page, "/settlements_and_liens", /Search settlements/i, "ST-0954");
  await shot(page, "set-1", {}, { settle: 600 });
  await page.mouse.move(1200, 500);
  await page.mouse.wheel(0, 500);
  await shot(page, "set-2", {}, { settle: 800 });
});

test("matter trust ledger", async ({ page }) => {
  await prepare(page);
  await openRecord(page, "/matters", /Search matters/i, "MT-2441");
  await page.getByRole("dialog").getByText("Trust Ledger (CTA)", { exact: true }).first().click();
  await shot(page, "mtrust-1", {}, { settle: 1600 });
});

test("trust and receivables reports", async ({ page }) => {
  await prepare(page);
  await page.goto("/reports");
  await page.waitForLoadState("networkidle");
  await page.getByText("Trust account: monthly reconciliation", { exact: true }).first().click();
  await shot(page, "rpt-recon", {}, { settle: 1800 });
  await page.getByText("Receivables by age", { exact: true }).first().click();
  await shot(page, "rpt-ar", {}, { settle: 1800 });
});
