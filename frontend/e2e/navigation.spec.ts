import { expect, openSection, test } from "./fixtures";

/**
 * Every destination in the building, with the title Layout's `pageTitle()`
 * should put in the page's h1. Several are the interesting ones — `trust_ledger_cta`,
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

/** The floors, in the order the folder tabs run, with what each opens on. */
const FLOORS = [
  { tab: "Reception", opens: "/" },
  { tab: "New Business", opens: "/intake_and_leads" },
  { tab: "Client Care", opens: "/clients" },
  { tab: "Case Management", opens: "/matters" },
  { tab: "Profitability", opens: "/time_entries" },
  { tab: "Compliance", opens: "/trust_ledger_cta" },
  { tab: "Risk & Deadlines", opens: "/court_calendar" },
  { tab: "Documents", opens: "/files" },
  { tab: "Practice Insight", opens: "/reports" },
  { tab: "Lookups & Settings", opens: "/lookups" },
] as const;

test.describe("The building", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("files every destination under a floor", async ({ page }) => {
    const floors = page.getByRole("navigation", { name: "Floors" });
    await expect(floors.getByRole("link")).toHaveCount(FLOORS.length);
    for (const { tab } of FLOORS) {
      await expect(floors.getByRole("link", { name: new RegExp(tab) })).toBeVisible();
    }

    // "All sections" is the whole building on one sheet: every destination.
    await page.getByRole("button", { name: "All sections" }).click();
    const directory = page.getByRole("dialog", { name: "All sections" });
    await expect(directory.getByRole("link")).toHaveCount(DESTINATIONS.length);
    for (const { link, path } of DESTINATIONS) {
      await expect(directory.locator(`a[href="${path}"]`)).toContainText(link);
    }
    // A parked run is announced on its section here too.
    await expect(directory.getByRole("link", { name: "Workflows, 2 waiting on you" })).toBeVisible();
  });

  for (const { tab, opens } of FLOORS) {
    test(`the ${tab} tab opens its first section`, async ({ page }) => {
      await page
        .getByRole("navigation", { name: "Floors" })
        .getByRole("link", { name: new RegExp(tab) })
        .click();
      await expect(page).toHaveURL(opens);
    });
  }

  for (const { link, path, title } of DESTINATIONS) {
    test(`navigates to ${link}`, async ({ page }) => {
      await openSection(page, link);

      await expect(page).toHaveURL(path);
      // The frame's h1 is the one heading guaranteed on every page.
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      // Arrived, the section is the one marked on its floor's strip. Located
      // by href rather than accessible name: an entry carrying a count badge —
      // Workflows, when a run is parked — has the count in its name by design.
      const entry = page.locator("nav.nav").locator(`a[href="${path}"]`);
      await expect(entry).toContainText(link);
      await expect(entry).toHaveClass(/active/);
    });
  }

  test("marks the current destination active", async ({ page }) => {
    const nav = page.locator("nav.nav");
    await expect(nav.locator(".nav-item.active")).toHaveText("Dashboard");
    await expect(
      page.getByRole("navigation", { name: "Floors" }).getByRole("link", { name: /Reception/ })
    ).toHaveAttribute("aria-current", "page");

    await page
      .getByRole("navigation", { name: "Floors" })
      .getByRole("link", { name: /Profitability/ })
      .click();
    await nav.getByRole("link", { name: "Costs & Disbursements", exact: true }).click();
    await expect(nav.locator(".nav-item.active")).toHaveText("Costs & Disbursements");
    await expect(
      page.getByRole("navigation", { name: "Floors" }).getByRole("link", { name: /Profitability/ })
    ).toHaveAttribute("aria-current", "page");

    // One section lit at a time.
    await expect(nav.locator(".nav-item.active")).toHaveCount(1);
  });

  test("survives a full reload on a deep route", async ({ page }) => {
    await page.goto("/time_entries?view=ledger");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Time Entries", level: 1 })
    ).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(3);
  });

  test("supports browser back and forward", async ({ page }) => {
    await openSection(page, "Timekeepers");
    await expect(page).toHaveURL(/\/timekeepers$/);

    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/timekeepers$/);
  });

  test("finds a section by name in the directory", async ({ page }) => {
    await page.getByRole("button", { name: "All sections" }).click();
    const directory = page.getByRole("dialog", { name: "All sections" });
    await directory.getByPlaceholder("Find a section").fill("trust");
    await expect(directory.getByRole("link")).toHaveCount(1);
    await directory.getByRole("link", { name: "Trust Ledger (CTA)" }).click();
    await expect(page).toHaveURL("/trust_ledger_cta");
    await expect(directory).toHaveCount(0);
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
