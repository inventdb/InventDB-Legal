import type { Page } from "@playwright/test";

import { expect, signedOut, test } from "./fixtures";

/**
 * Runs only in the `mobile` project (Pixel 7, 412px wide), which is below both
 * the 720px phone breakpoint — bottom bar, one screen at a time — and the
 * 960px login reflow.
 */
test.describe("Mobile shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  const bar = (page: Page) => page.getByRole("navigation", { name: "Main" });
  const directory = (page: Page) => page.getByRole("dialog", { name: "All sections" });

  test("puts the main places on a bottom bar, the rest one tap away", async ({ page }) => {
    // The floor tabs give way to the bar on a phone.
    await expect(page.getByRole("navigation", { name: "Floors" })).toBeHidden();
    for (const name of ["Reception", "Matters", "Docket", "Time"]) {
      await expect(bar(page).getByRole("link", { name })).toBeVisible();
    }
    await expect(bar(page).getByRole("link", { name: "Reception" })).toHaveClass(/active/);

    await bar(page).getByRole("link", { name: "Docket" }).click();
    await expect(page).toHaveURL(/\/deadlines_and_sol$/);
    await expect(bar(page).getByRole("link", { name: "Docket" })).toHaveClass(/active/);
  });

  test("opens every section from All sections, and closes on arrival", async ({ page }) => {
    await bar(page).getByRole("button", { name: /^All sections/ }).click();
    await expect(directory(page)).toBeVisible();
    // The sheet takes the whole width of the phone.
    const box = await directory(page).boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(page.viewportSize()?.width);

    await directory(page).getByRole("link", { name: "Timekeepers", exact: true }).click();
    await expect(page).toHaveURL(/\/timekeepers$/);
    await expect(directory(page)).toHaveCount(0);
    // A floor with more than one section lists them under its header.
    await expect(page.locator("nav.nav").getByRole("link", { name: "Matters" })).toBeVisible();
  });

  test("closes All sections from its close button", async ({ page }) => {
    await bar(page).getByRole("button", { name: /^All sections/ }).click();
    await directory(page).getByRole("button", { name: "Close" }).click();
    await expect(directory(page)).toHaveCount(0);
  });

  test("never scrolls the page horizontally", async ({ page }) => {
    for (const path of [
      "/",
      "/matters",
      "/matters?view=ledger",
      "/invoices?view=ledger",
      "/workflows",
      "/reports",
      "/settings",
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test("shows the index, then the record on its own screen", async ({ page }) => {
    await page.goto("/matters");
    const index = page.getByRole("region", { name: "Matters index" });
    await expect(index).toBeVisible();

    await index.locator(".cb-card", { hasText: "Pineda v. Bright Path" }).click();
    await expect(index).toBeHidden();
    await expect(page.locator(".cb-paper .cb-party").first()).toContainText("Pineda");

    await page.locator(".cb-paper").getByRole("button", { name: "Matters" }).click();
    await expect(index).toBeVisible();
  });

  test("keeps the dashboard's starting point reachable", async ({ page }) => {
    // The dashboard is a configurable grid, so a phone opens on the same
    // onboarding state a desktop does — both ways in have to be tappable.
    await expect(page.getByRole("heading", { name: /No widgets/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Suggest from my legal data/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add a widget" })).toBeVisible();
  });

  test("gives a widget the full width rather than a squeezed column", async ({ page }) => {
    // Every span collapses to one column below the breakpoint: a 3-of-12 figure
    // on a phone is a figure nobody can read.
    // An empty dashboard has no grid once it has loaded, which the catch
    // already treats as one column; the short timeout stops the lookup from
    // waiting out the whole test for a grid that will not appear.
    const columns = await page
      .locator(".bento")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length, undefined, {
        timeout: 3000,
      })
      .catch(() => 1);
    expect(columns).toBe(1);
  });

  test("sets a ledger out as one card per row", async ({ page }) => {
    await page.goto("/matters?view=ledger");
    const wrap = page.locator(".table-wrap");
    await expect(wrap).toBeVisible();
    // No column heads to scroll after: each value carries its own label.
    await expect(page.locator("table.data thead")).toBeHidden();
    const cell = page.locator("table.data tbody tr").first().locator("td[data-label='Caption']");
    await expect(cell).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("searches the whole firm on a screen of its own", async ({ page }) => {
    await page.getByRole("button", { name: "Search the whole firm" }).click();
    const search = page.getByRole("dialog", { name: "Search the whole firm" });
    await expect(search).toBeVisible();
    await search.getByRole("textbox").fill("Pineda");
    await search.getByRole("option", { name: /Pineda v\. Bright Path/ }).first().click();
    await expect(page).toHaveURL(/\/matters/);
    await expect(page.locator(".cb-paper .cb-party").first()).toContainText("Pineda");
  });
});

test.describe("Mobile login", () => {
  test.use(signedOut);

  test("reflows the hero around the sign-in card", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator(".hero-badge")).toBeVisible();

    // `.login-hero::after` is switched off at this width because its bloom
    // would otherwise widen the page once the panel becomes display: contents.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("can sign in on a phone", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username", { exact: true }).fill("e2e.manager");
    await page.getByLabel("Password", { exact: true }).fill("correct-horse");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });
});
