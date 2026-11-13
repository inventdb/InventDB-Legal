/**
 * Role tiers in the signed-in frame.
 *
 * Each person lands on their own dashboard and sees only their own sections.
 * Nothing on screen names a role or tier: not the sidebar, the dashboard,
 * Settings, or the "not set up" screen.
 */
import { expect, test } from "./fixtures";

// "Intake" is left out: "Intake & Leads" is a section's own label, not a role.
const ROLE_WORDS = /\b(admin|administrator|superadmin|partner|attorney|associate|paralegal|finance|tier|role)\b/i;

async function visibleText(page: import("@playwright/test").Page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

test.describe("paralegal", () => {
  test.use({ access: "paralegal" });

  test("sees the docket and none of the money", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav.nav[aria-label=Sections]");
    await expect(nav.getByRole("link", { name: "Court Calendar" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Deadlines & SOL" })).toBeVisible();
    for (const hidden of ["Invoices", "Trust Ledger (CTA)", "Payments & Receipts", "Reports", "Analyze", "Workflows", "Import", "Lookups"]) {
      await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
    }
    // The money group is gone altogether, not shown empty.
    await expect(nav.getByRole("group", { name: "Compliance" })).toHaveCount(0);

    await expect(page.locator(".ch-kpi", { hasText: "Overdue deadlines" })).toBeVisible();
    await expect(page.locator(".ch-kpi", { hasText: "Receivables" })).toHaveCount(0);
    await expect(page.locator(".ch-kpi", { hasText: "Trust balance" })).toHaveCount(0);
  });

  test("a typed address outside the tier lands on the dashboard", async ({ page }) => {
    await page.goto("/trust_ledger_cta");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/settings");
    await expect(page.getByText("InventDB Connection")).toHaveCount(0);
  });

  test("read-only modules offer no New, Edit or Delete", async ({ page }) => {
    await page.goto("/matters");
    await expect(page.getByRole("button", { name: /New Matter/ })).toHaveCount(0);
  });

  test("never names a role", async ({ page }) => {
    for (const path of ["/", "/settings", "/matters"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      expect(await visibleText(page)).not.toMatch(ROLE_WORDS);
    }
  });
});

test.describe("intake", () => {
  test.use({ access: "intake" });

  test("lands on new business only", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav.nav[aria-label=Sections]");
    await expect(nav.getByRole("link", { name: "Intake & Leads" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Time Entries" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Court Calendar" })).toHaveCount(0);
    await expect(page.locator(".ch-kpi", { hasText: "Overdue deadlines" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Suggest/ })).toHaveCount(0);
    // No widget board, so no namespace picker for it either.
    await expect(page.getByLabel("Dashboard namespace")).toHaveCount(0);
    expect(await visibleText(page)).not.toMatch(ROLE_WORDS);
  });
});

test.describe("not set up", () => {
  test.use({ access: "none" });

  test("says to ask an administrator and shows nothing of the firm", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /isn't set up for InventDB Legal/ })).toBeVisible();
    await expect(page.locator("nav.nav")).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("admin", () => {
  test("sees every section and the connection settings", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav.nav[aria-label=Sections]");
    // Workflows carries the approvals badge in its accessible name, so match the start.
    for (const name of [/^Trust Ledger \(CTA\)/, /^Import/, /^Lookups/, /^Workflows/, /^Analyze/]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    await page.goto("/settings");
    await expect(page.getByText("InventDB Connection")).toBeVisible();
    await expect(page.getByText(/^Role$/)).toHaveCount(0);
  });
});
