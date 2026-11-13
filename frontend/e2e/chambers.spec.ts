import type { Page, Request } from "@playwright/test";

import { dialog, expect, field, test } from "./fixtures";

/**
 * Chambers: a module opens on its DOCKET — one row per record, its date set
 * out on the left — and a row opens the record as a DOSSIER in its place, with
 * a back link to the docket. The TABLE is one click away, remembered per
 * module.
 */

const docket = (page: Page) => page.getByRole("region", { name: "Matters docket" });
const dossier = (page: Page) => page.locator("article.ch-dossier");
const row = (page: Page, text: string) => docket(page).locator(".ch-drow", { hasText: text });

test.describe("The docket", () => {
  test("opens a module on its docket, one row per record", async ({ page, store }) => {
    await page.goto("/matters");
    await expect(page.getByRole("group", { name: "Show as" }).getByRole("button", { name: "Docket" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(docket(page).locator(".ch-drow")).toHaveCount(store.matters.length);
    await expect(page.locator(".count-pill")).toHaveText(`${store.matters.length} records`);
    // Nothing is open until a row is chosen.
    await expect(dossier(page)).toHaveCount(0);
  });

  test("sets each row out by its date, under a heading for when it falls", async ({ page }) => {
    await page.goto("/matters");
    // Matters run newest-opened first, so the rows fall under month headings.
    await expect(docket(page).locator(".ch-docket-group").first()).toBeVisible();
    const first = docket(page).locator(".ch-drow").first();
    await expect(first.locator(".ch-date .d")).toHaveText(/^\d{1,2}$/);
    await expect(first.locator(".ch-cap .t")).not.toBeEmpty();
  });

  test("narrows the docket by status, on the server", async ({ page, store }) => {
    const asked: string[] = [];
    page.on("request", (r: Request) => {
      if (r.url().includes("/api/matters?")) asked.push(r.url());
    });
    await page.goto("/matters");
    const chips = page.getByRole("group", { name: "Status" });
    await chips.getByRole("button", { name: "Closed" }).click();

    const closed = store.matters.filter((m) => m.status === "Closed").length;
    await expect(docket(page).locator(".ch-drow")).toHaveCount(closed);
    expect(asked.some((u) => new URL(u).searchParams.get("status") === "Closed")).toBe(true);
    await expect(chips.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "true");

    await chips.getByRole("button", { name: "All" }).click();
    await expect(docket(page).locator(".ch-drow")).toHaveCount(store.matters.length);
  });

  test("searches the docket with the module's own search", async ({ page }) => {
    await page.goto("/matters");
    await page.getByPlaceholder("Search matters…").fill("Zhang");
    await expect(docket(page).locator(".ch-drow")).toHaveCount(1);
    await expect(docket(page).locator(".ch-drow")).toContainText("In re Zhang");
  });
});

test.describe("The dossier", () => {
  test("opens a row as its dossier, and the back link returns to the docket", async ({ page }) => {
    await page.goto("/matters");
    await row(page, "Pineda v. Bright Path").click();

    await expect(docket(page)).toHaveCount(0);
    await expect(dossier(page).getByRole("heading", { name: "Pineda v. Bright Path", level: 2 })).toBeVisible();
    await expect(dossier(page).locator(".ch-number")).toContainText("MT-2018");
    // A matter is marked privileged, and says what it holds in trust.
    await expect(dossier(page).locator(".ch-tag.privileged")).toBeVisible();
    await expect(
      dossier(page).getByLabel("Trust balance").or(dossier(page).getByText("does not hold client funds"))
    ).toBeVisible();

    await dossier(page).getByRole("button", { name: "Matters" }).click();
    await expect(docket(page)).toBeVisible();
  });

  test("edits the record from its dossier, and the dossier shows the change", async ({ page }) => {
    await page.goto("/matters");
    await row(page, "In re Zhang").click();
    await dossier(page).getByRole("button", { name: "Edit" }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(field(page, "matter_caption")).toHaveValue("In re Zhang");
    await field(page, "matter_caption").fill("In re Zhang (amended)");
    await dialog(page).getByRole("button", { name: /Save|Update/ }).click();

    await expect(page.locator(".toast")).toContainText("Matter updated");
    await expect(dossier(page).getByRole("heading", { name: "In re Zhang (amended)" })).toBeVisible();
    await dossier(page).getByRole("button", { name: "Matters" }).click();
    await expect(row(page, "In re Zhang (amended)")).toBeVisible();
  });

  test("deletes the record from its dossier, and returns to the docket", async ({ page, store }) => {
    const before = store.matters.length;
    await page.goto("/matters");
    await row(page, "In re Zhang").click();
    await dossier(page).getByRole("button", { name: "Delete" }).click();
    await dialog(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.locator(".toast")).toContainText("Matter deleted");
    await expect(docket(page).locator(".ch-drow")).toHaveCount(before - 1);
    await expect(row(page, "In re Zhang")).toHaveCount(0);
  });

  test("lists what points at the record under Related", async ({ page }) => {
    await page.goto("/matters");
    await row(page, "In re Marriage of Chen").click();
    await dossier(page).getByRole("tab", { name: /Related/ }).click();
    await expect(dossier(page).getByRole("tabpanel", { name: "Related" })).toContainText("Time Entries");
  });

  test("opens a linked record in the panel, one level deeper", async ({ page }) => {
    await page.goto("/matters");
    await row(page, "In re Marriage of Chen").click();
    await dossier(page).getByRole("button", { name: /CL-/ }).first().click();
    const panel = page.locator("aside.drill-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".drill-kicker")).toContainText("Client");
  });

  test("?focus= opens that record's dossier", async ({ page }) => {
    await page.goto("/matters?focus=mt-1");
    await expect(dossier(page).locator(".ch-number")).toContainText("MT-2018");
    // A deep link is read once: a reload keeps the module, not the focus.
    await expect(page).not.toHaveURL(/focus=/);
  });
});

test.describe("Docket and table", () => {
  test("remembers the table once chosen, per module", async ({ page }) => {
    await page.goto("/matters");
    await page.getByRole("group", { name: "Show as" }).getByRole("button", { name: "Table" }).click();
    await expect(page.locator("table.data")).toBeVisible();
    await expect(page).toHaveURL(/view=table/);

    await page.goto("/matters");
    await expect(page.locator("table.data")).toBeVisible();
    // Another module still opens on its docket.
    await page.goto("/clients");
    await expect(page.getByRole("region", { name: "Clients docket" })).toBeVisible();
  });

  test("still reads the casebook's names for the views", async ({ page }) => {
    await page.goto("/matters?view=ledger");
    await expect(page.locator("table.data")).toBeVisible();
    await page.goto("/matters?view=index");
    await expect(docket(page)).toBeVisible();
  });
});

test.describe("Searching the firm", () => {
  test("finds a record in any module and opens its dossier", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Search the whole firm" }).fill("Zhang");
    const results = page.getByRole("listbox", { name: "Search results" });
    await results.getByRole("option", { name: /In re Zhang/ }).first().click();

    await expect(page).toHaveURL(/\/matters/);
    await expect(dossier(page).getByRole("heading", { name: "In re Zhang" })).toBeVisible();
  });

  test("Ctrl+K puts you in the search box", async ({ page }) => {
    await page.goto("/clients");
    const box = page.getByRole("textbox", { name: "Search the whole firm" });
    await expect(box).toBeVisible();
    await expect(box).not.toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(box).toBeFocused();
  });
});
