import { MODULES, expect, rows, test } from "./fixtures";

/**
 * Every module is one generic component driven by `config/entities.ts`, so
 * these run the same contract across all of them. A module that renders at all
 * is a module whose config, route and API wiring all line up.
 */
test.describe("Entity modules", () => {
  for (const { name, label, plural } of MODULES) {
    test(`${plural} lists its records`, async ({ page, store }) => {
      await page.goto(`/${name}`);

      await expect(page.getByRole("heading", { name: plural, level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: plural, level: 2 })).toBeVisible();

      await expect(page.locator(".count-pill")).toHaveText(`${store[name].length} records`);
      await expect(rows(page)).toHaveCount(store[name].length);

      await expect(page.getByRole("button", { name: `New ${label}` })).toBeVisible();
      await expect(
        page.getByPlaceholder(`Search ${plural.toLowerCase()}…`)
      ).toBeVisible();
    });
  }
});

test.describe("List table", () => {
  test("shows the business key column for keyed modules", async ({ page }) => {
    await page.goto("/matters");
    const headers = page.locator("table.data thead th");
    await expect(headers.first()).toHaveText("matter_id");
    await expect(headers.last()).toHaveText("Actions");
    await expect(page.getByRole("cell", { name: "MT-2018", exact: true })).toBeVisible();
  });

  test("hides the key column for lookups, whose key is a real field", async ({ page }) => {
    await page.goto("/lookups");
    const headers = page.locator("table.data thead th");

    await expect(headers.first()).toHaveText("List");
    // `lookups.key` is `value`, which is also a table column. Rendering the key
    // column too would show it twice; the anchored regex is what tells the raw
    // key header apart from the "Value" label of the field itself.
    await expect(headers.filter({ hasText: /^value$/ })).toHaveCount(0);
    // Four table fields plus Actions, and no leading key column.
    await expect(headers).toHaveCount(5);
  });

  test("renders status values as toned badges", async ({ page }) => {
    await page.goto("/matters");
    const open = page.locator("table.data .badge", { hasText: "Open" });
    await expect(open.first()).toHaveClass(/success/);
    await expect(
      page.locator("table.data .badge", { hasText: "Closed" }).first()
    ).toHaveClass(/warn|info|neutral|danger/);
  });

  test("resolves reference columns to a human title", async ({ page }) => {
    // time_entries.matter_id is a ref with `table: true`, so the cell shows the
    // matter's caption rather than the raw MT-2018 key.
    await page.goto("/time_entries");
    const entry = page.locator("table.data tbody tr", { hasText: "TE-127126" });
    await expect(entry).toContainText("Pineda v. Bright Path");
  });

  test("formats currency and date cells", async ({ page }) => {
    await page.goto("/invoices");
    const paid = page.locator("table.data tbody tr", { hasText: "INV-2026-1553" });
    await expect(paid).toContainText("$1,154");
    await expect(paid).toContainText("Jul 14, 2026");
  });

  test("renders an em dash for missing values", async ({ page }) => {
    await page.goto("/matters");
    // The closed immigration matter has no next court date.
    const closed = page.locator("table.data tbody tr", { hasText: "In re Zhang" });
    await expect(closed).toContainText("—");
  });

  test("shows the empty state when a module has no records", async ({ page }) => {
    await page.route("**/api/costs_and_disbursements*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, limit: 500, offset: 0 }),
      })
    );
    await page.goto("/costs_and_disbursements");

    await expect(
      page.getByRole("heading", { name: "No costs & disbursements yet" })
    ).toBeVisible();
    await expect(page.getByText("Add your first cost to get started.")).toBeVisible();
    // The empty state offers the same create action as the page head.
    await expect(page.getByRole("button", { name: "New Cost" })).toHaveCount(2);
  });
});

test.describe("Search and sort", () => {
  test("filters the table with the debounced search box", async ({ page }) => {
    await page.goto("/matters");
    await expect(rows(page)).toHaveCount(3);

    await page.getByPlaceholder("Search matters…").fill("Chen, Qing");

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("In re Marriage of Chen");
    await expect(page.locator(".count-pill")).toHaveText("1 records");
  });

  test("sends the search term to the server rather than filtering locally", async ({ page }) => {
    await page.goto("/matters");

    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/matters") && r.url().includes("q=Chen")
      ),
      page.getByPlaceholder("Search matters…").fill("Chen"),
    ]);
    expect(new URL(request.url()).searchParams.get("q")).toBe("Chen");
  });

  test("shows a distinct empty state when the search matches nothing", async ({ page }) => {
    await page.goto("/matters");
    await page.getByPlaceholder("Search matters…").fill("zzzznotfound");

    await expect(page.getByRole("heading", { name: "No matching records" })).toBeVisible();
    await expect(page.getByText("Try a different search term.")).toBeVisible();
    // No create shortcut here — the module isn't empty, the filter is.
    await expect(page.getByRole("button", { name: "New Matter" })).toHaveCount(1);
  });

  test("toggles sort direction when a column header is clicked", async ({ page }) => {
    await page.goto("/matters");
    // Matters default to date_opened descending — newest first.
    await expect(rows(page).first()).toContainText("In re Marriage of Chen");

    await page.getByRole("columnheader", { name: "Caption" }).click();
    await expect(rows(page).first()).toContainText("In re Marriage of Chen");

    await page.getByRole("columnheader", { name: "Caption" }).click();
    await expect(rows(page).first()).toContainText("Pineda v. Bright Path");
  });

  test("sorts by a different column and sends order_by", async ({ page }) => {
    await page.goto("/matters");

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("order_by=practice_area")),
      page.getByRole("columnheader", { name: "Practice Area" }).click(),
    ]);

    const params = new URL(request.url()).searchParams;
    expect(params.get("order_by")).toBe("practice_area");
    expect(params.get("order_dir")).toBe("asc");
    // Family Law sorts ahead of Immigration and Personal Injury.
    await expect(rows(page).first()).toContainText("Chen, Qing");
  });
});
