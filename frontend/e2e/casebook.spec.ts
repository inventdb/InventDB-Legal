import type { Page, Request } from "@playwright/test";

import { dialog, expect, field, test } from "./fixtures";

/**
 * The casebook: a module opens on its INDEX — the records as cards, the chosen
 * one set out as a page beside them — with the LEDGER (the table) one click
 * away, remembered per module.
 */

const index = (page: Page) => page.getByRole("region", { name: "Matters index" });
const paper = (page: Page) => page.locator("article.cb-paper");
const card = (page: Page, text: string) => index(page).locator(".cb-card", { hasText: text });

test.describe("The index", () => {
  test("opens a module on its index, with the first record on the page", async ({ page, store }) => {
    await page.goto("/matters");
    await expect(page.getByRole("group", { name: "Show as" }).getByRole("button", { name: "Index" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(index(page).locator(".cb-card")).toHaveCount(store.matters.length);
    await expect(page.locator(".count-pill")).toHaveText(`${store.matters.length} records`);

    const first = index(page).locator(".cb-card").first();
    await expect(first).toHaveAttribute("aria-current", "true");
    // The page reads the same record the first card names.
    const number = (await first.locator(".no span").first().innerText()).trim();
    await expect(paper(page).locator(".cb-caseno")).toContainText(number);
  });

  test("sets an adverse caption out as the two parties", async ({ page }) => {
    await page.goto("/matters");
    await card(page, "Pineda v. Bright Path").click();

    await expect(card(page, "Pineda v. Bright Path")).toHaveAttribute("aria-current", "true");
    const parties = paper(page).locator(".cb-party");
    await expect(parties).toHaveCount(2);
    await expect(parties.nth(0)).toContainText("Pineda");
    await expect(parties.nth(1)).toContainText("Bright Path");
    await expect(paper(page).locator(".cb-role", { hasText: "Defendant" })).toBeVisible();
    // The record's title is still its heading, for anyone moving by headings.
    await expect(paper(page).getByRole("heading", { name: "Pineda v. Bright Path", level: 2 })).toBeAttached();
  });

  test("names everything else 'in the matter of'", async ({ page }) => {
    await page.goto("/matters");
    await card(page, "In re Zhang").click();
    await expect(paper(page).getByRole("heading", { name: "In re Zhang", level: 2 })).toBeVisible();
    await expect(paper(page).locator(".cb-role").first()).toHaveText("In the matter of");
  });

  test("narrows the index by status, on the server", async ({ page, store }) => {
    const asked: string[] = [];
    page.on("request", (r: Request) => {
      if (r.url().includes("/api/matters?")) asked.push(r.url());
    });
    await page.goto("/matters");
    const chips = page.getByRole("group", { name: "Status" });
    await chips.getByRole("button", { name: "Closed" }).click();

    const closed = store.matters.filter((m) => m.status === "Closed").length;
    await expect(index(page).locator(".cb-card")).toHaveCount(closed);
    expect(asked.some((u) => new URL(u).searchParams.get("status") === "Closed")).toBe(true);
    await expect(chips.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "true");

    await chips.getByRole("button", { name: "All" }).click();
    await expect(index(page).locator(".cb-card")).toHaveCount(store.matters.length);
  });

  test("searches the index with the module's own search", async ({ page }) => {
    await page.goto("/matters");
    await page.getByPlaceholder("Search matters…").fill("Zhang");
    await expect(index(page).locator(".cb-card")).toHaveCount(1);
    await expect(index(page).locator(".cb-card")).toContainText("In re Zhang");
  });
});

test.describe("The page", () => {
  test("edits the record from its page, and the page shows the change", async ({ page }) => {
    await page.goto("/matters");
    await card(page, "In re Zhang").click();
    await paper(page).getByRole("button", { name: "Edit" }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(field(page, "matter_caption")).toHaveValue("In re Zhang");
    await field(page, "matter_caption").fill("In re Zhang (amended)");
    await dialog(page).getByRole("button", { name: /Save|Update/ }).click();

    await expect(page.locator(".toast")).toContainText("Matter updated");
    await expect(paper(page).getByRole("heading", { name: "In re Zhang (amended)" })).toBeVisible();
    await expect(card(page, "In re Zhang (amended)")).toBeVisible();
  });

  test("deletes the record from its page, and the index moves on", async ({ page, store }) => {
    const before = store.matters.length;
    await page.goto("/matters");
    await card(page, "In re Zhang").click();
    await paper(page).getByRole("button", { name: "Delete" }).click();
    await dialog(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.locator(".toast")).toContainText("Matter deleted");
    await expect(index(page).locator(".cb-card")).toHaveCount(before - 1);
    await expect(card(page, "In re Zhang")).toHaveCount(0);
    // The page is never left blank while the index has something to show.
    await expect(index(page).locator('.cb-card[aria-current="true"]')).toHaveCount(1);
  });

  test("lists what points at the record under Related", async ({ page }) => {
    await page.goto("/matters");
    await card(page, "In re Marriage of Chen").click();
    await paper(page).getByRole("tab", { name: /Related/ }).click();
    await expect(paper(page).getByRole("tabpanel", { name: "Related" })).toContainText("Time Entries");
  });

  test("opens a linked record in the panel, one level deeper", async ({ page }) => {
    await page.goto("/matters");
    await card(page, "In re Marriage of Chen").click();
    await paper(page).getByRole("button", { name: /CL-/ }).first().click();
    const panel = page.locator("aside.drill-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".drill-kicker")).toContainText("Client");
  });

  test("?focus= opens that record on the page", async ({ page }) => {
    await page.goto("/matters?focus=mt-1");
    await expect(paper(page).locator(".cb-caseno")).toContainText("MT-2018");
    // A deep link is read once: a reload keeps the module, not the focus.
    await expect(page).not.toHaveURL(/focus=/);
  });
});

test.describe("Index and ledger", () => {
  test("remembers the ledger once chosen, per module", async ({ page }) => {
    await page.goto("/matters");
    await page.getByRole("group", { name: "Show as" }).getByRole("button", { name: "Ledger" }).click();
    await expect(page.locator("table.data")).toBeVisible();
    await expect(page).toHaveURL(/view=ledger/);

    await page.goto("/matters");
    await expect(page.locator("table.data")).toBeVisible();
    // Another module still opens on its index.
    await page.goto("/clients");
    await expect(page.getByRole("region", { name: "Clients index" })).toBeVisible();
  });
});

test.describe("Searching the firm", () => {
  test("finds a record in any module and opens it in its casebook", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Search the whole firm" }).fill("Zhang");
    const results = page.getByRole("listbox", { name: "Search results" });
    await results.getByRole("option", { name: /In re Zhang/ }).first().click();

    await expect(page).toHaveURL(/\/matters/);
    await expect(paper(page).getByRole("heading", { name: "In re Zhang" })).toBeVisible();
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
