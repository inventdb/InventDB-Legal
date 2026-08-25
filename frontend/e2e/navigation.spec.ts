import { expect, test } from "./fixtures";

/**
 * Every sidebar destination, with the title Layout's `pageTitle()` should put
 * in the topbar. Several are the interesting ones — `trust_ledger_cta`,
 * `deadlines_and_sol` and `costs_and_disbursements` all have a route segment
 * and a label that deliberately disagree.
 */
const DESTINATIONS = [
  { link: "Dashboard", path: "/", title: "Dashboard" },
  { link: "Import", path: "/import", title: "Import" },
  { link: "Matters", path: "/matters", title: "Matters" },
  { link: "Clients", path: "/clients", title: "Clients" },
  { link: "Timekeepers", path: "/timekeepers", title: "Timekeepers" },
  { link: "Time Entries", path: "/time_entries", title: "Time Entries" },
  {
    link: "Costs & Disbursements",
    path: "/costs_and_disbursements",
    title: "Costs & Disbursements",
  },
  { link: "Invoices", path: "/invoices", title: "Invoices" },
  {
    link: "Payments & Receipts",
    path: "/payments_and_receipts",
    title: "Payments & Receipts",
  },
  {
    link: "Trust Ledger (CTA)",
    path: "/trust_ledger_cta",
    title: "Trust Ledger (CTA)",
  },
  { link: "Court Calendar", path: "/court_calendar", title: "Court Calendar" },
  { link: "Deadlines & SOL", path: "/deadlines_and_sol", title: "Deadlines & SOL" },
  { link: "Intake & Leads", path: "/intake_and_leads", title: "Intake & Leads" },
  {
    link: "Settlements & Liens",
    path: "/settlements_and_liens",
    title: "Settlements & Liens",
  },
  { link: "Lookups", path: "/lookups", title: "Lookups" },
  { link: "Analyze", path: "/analyze", title: "Analyze" },
  { link: "Workflows", path: "/workflows", title: "Workflows" },
  { link: "Reports", path: "/reports", title: "Reports" },
  { link: "Files", path: "/files", title: "Files" },
  { link: "Settings", path: "/settings", title: "Settings" },
] as const;

test.describe("Sidebar navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders every section and destination", async ({ page }) => {
    const nav = page.locator("nav.nav");
    for (const section of [
      "Practice",
      "Time & Billing",
      "Money",
      "Calendar & Docket",
      "Intake",
      "Automation & Insights",
    ]) {
      await expect(nav.locator(".nav-section", { hasText: section })).toBeVisible();
    }
    await expect(nav.getByRole("link")).toHaveCount(DESTINATIONS.length);
  });

  for (const { link, path, title } of DESTINATIONS) {
    test(`navigates to ${link}`, async ({ page }) => {
      // Located by href rather than accessible name. An entry that carries a
      // count badge — Workflows, when a run is parked — has that count in its
      // name by design ("Workflows, 2 waiting on you"), which is right for a
      // screen reader and fatal to an exact-name match.
      const entry = page.locator("nav.nav").locator(`a[href="${path}"]`);
      await expect(entry).toContainText(link);
      await entry.click();

      await expect(page).toHaveURL(path);
      // The topbar h1 is the only heading guaranteed on every page; entity
      // pages repeat the same text in an h2, so the level matters.
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    });
  }

  test("marks the current destination active", async ({ page }) => {
    const nav = page.locator("nav.nav");
    await expect(nav.locator(".nav-item.active")).toHaveText("Dashboard");

    await nav
      .getByRole("link", { name: "Costs & Disbursements", exact: true })
      .click();
    await expect(nav.locator(".nav-item.active")).toHaveText("Costs & Disbursements");

    // Dashboard's link is `end`, so a child route must not light it up too.
    await expect(nav.locator(".nav-item.active")).toHaveCount(1);
  });

  test("survives a full reload on a deep route", async ({ page }) => {
    await page.goto("/time_entries");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Time Entries", level: 1 })
    ).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(3);
  });

  test("supports browser back and forward", async ({ page }) => {
    await page
      .locator("nav.nav")
      .getByRole("link", { name: "Timekeepers", exact: true })
      .click();
    await expect(page).toHaveURL(/\/timekeepers$/);

    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/timekeepers$/);
  });
});

test.describe("Unmatched routes", () => {
  test("shows Unknown module for a single unknown segment", async ({ page }) => {
    // `:entity` outranks the `*` splat for a one-segment path, so this lands
    // on EntityListPage with no matching config rather than redirecting.
    await page.goto("/not-a-module");
    await expect(page.getByRole("heading", { name: "Unknown module" })).toBeVisible();
    await expect(page.getByText('No module named "not-a-module".')).toBeVisible();
  });

  test("redirects a deep unknown path back to the dashboard", async ({ page }) => {
    await page.goto("/deep/unknown/path");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });
});
