import { dialog, expect, field, row, rows, test } from "./fixtures";

test.describe("Create", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/matters");
    await expect(rows(page)).toHaveCount(3);
  });

  test("creates a record and shows it in the table", async ({ page }) => {
    await page.getByRole("button", { name: "New Matter" }).click();
    await expect(dialog(page).getByRole("heading", { name: "New Matter" })).toBeVisible();

    await field(page, "matter_caption").fill("Ortega v. Verdugo Hills");
    await field(page, "client_name").fill("Ortega, Ruben");
    await field(page, "practice_area").selectOption("Employment");
    await field(page, "status").selectOption("Open");
    await field(page, "recorded_hours").fill("2");
    await field(page, "flat_fee_total").fill("1950");

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().endsWith("/api/matters") && r.method() === "POST"),
      dialog(page).getByRole("button", { name: "Save" }).click(),
    ]);

    // Numeric and currency fields are coerced out of their string form before
    // sending; untouched fields are omitted rather than sent as "".
    expect(request.postDataJSON()).toEqual({
      matter_caption: "Ortega v. Verdugo Hills",
      client_name: "Ortega, Ruben",
      practice_area: "Employment",
      status: "Open",
      recorded_hours: 2,
      flat_fee_total: 1950,
    });

    await expect(page.locator(".toast.success")).toHaveText("Matter created");
    await expect(dialog(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(4);
    await expect(row(page, "Ortega v. Verdugo Hills")).toBeVisible();
    await expect(page.locator(".count-pill")).toHaveText("4 records");
  });

  test("blocks submission while a required field is empty", async ({ page }) => {
    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/matters")) posted = true;
    });

    await page.getByRole("button", { name: "New Matter" }).click();
    await field(page, "client_name").fill("Chennai");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(dialog(page)).toBeVisible();
    // The required field is flagged inline rather than via a browser tooltip.
    await expect(field(page, "matter_caption")).toHaveAttribute("style", /border-color/);
    expect(posted).toBe(false);
  });

  test("populates reference dropdowns from the referenced module", async ({ page }) => {
    await page.getByRole("button", { name: "New Matter" }).click();

    // A combobox, not a <select>: this instance holds more matters and clients
    // than one query can return, so the datalist suggests and the input still
    // accepts any key that exists.
    const list = await field(page, "client_id").getAttribute("list");
    const options = page.locator(`datalist#${list} option`);
    await expect(options).toHaveText([
      "CL-1123 — Pineda, Carmen",
      "CL-1932 — Chen, Qing",
    ]);

    await field(page, "client_id").fill("CL-1932");
    await field(page, "matter_caption").fill("Zhang v. Kang Brothers");

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/api/matters")),
      dialog(page).getByRole("button", { name: "Save" }).click(),
    ]);
    expect(request.postDataJSON()).toMatchObject({ client_id: "CL-1932" });
  });

  test("offers the same create action from the empty state", async ({ page }) => {
    await page.route("**/api/matters*", (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, limit: 500, offset: 0 }),
      });
    });
    await page.reload();

    await page.locator(".empty").getByRole("button", { name: "New Matter" }).click();
    await expect(dialog(page).getByRole("heading", { name: "New Matter" })).toBeVisible();
  });

  test("reports a server-side create failure as a toast, keeping the form open", async ({ page }) => {
    await page.route("**/api/matters", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "matter_caption must be unique" }),
      });
    });

    await page.getByRole("button", { name: "New Matter" }).click();
    await field(page, "matter_caption").fill("Pineda v. Bright Path");
    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(page.locator(".toast.error")).toHaveText("matter_caption must be unique");
    await expect(dialog(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(3);
  });
});

test.describe("Edit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/matters");
    await expect(rows(page)).toHaveCount(3);
  });

  test("prefills the form from the record", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByRole("button", { name: "Edit" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Edit Matter" })).toBeVisible();
    await expect(field(page, "matter_caption")).toHaveValue("Pineda v. Bright Path");
    await expect(field(page, "client_name")).toHaveValue("Pineda, Carmen");
    await expect(field(page, "practice_area")).toHaveValue("Personal Injury");
    await expect(field(page, "status")).toHaveValue("Open");
    await expect(field(page, "recorded_hours")).toHaveValue("18.1");
    await expect(field(page, "date_opened")).toHaveValue("2025-12-22");
  });

  test("saves changes and refreshes the table", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByRole("button", { name: "Edit" }).click();
    // `stage` is a table column, so the edit has somewhere visible to land.
    await field(page, "stage").fill("Expert Discovery");
    await field(page, "flat_fee_total").fill("2600");

    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "PUT" && r.url().includes("/api/matters/mt-1")
      ),
      dialog(page).getByRole("button", { name: "Save" }).click(),
    ]);

    expect(request.postDataJSON()).toMatchObject({
      matter_caption: "Pineda v. Bright Path",
      stage: "Expert Discovery",
      flat_fee_total: 2600,
    });

    await expect(page.locator(".toast.success")).toHaveText("Matter updated");
    await expect(row(page, "Pineda v. Bright Path")).toContainText("Expert Discovery");
    await expect(rows(page)).toHaveCount(3);
  });

  test("discards edits when the modal is cancelled", async ({ page }) => {
    await row(page, "In re Marriage of Chen").getByRole("button", { name: "Edit" }).click();
    await field(page, "client_name").fill("Howrah");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, "In re Marriage of Chen")).toContainText("Chen, Qing");
  });
});

test.describe("Delete", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/matters");
    await expect(rows(page)).toHaveCount(3);
  });

  test("asks for confirmation naming the record", async ({ page }) => {
    await row(page, "In re Marriage of Chen").getByRole("button", { name: "Delete" }).click();

    await expect(dialog(page).getByRole("heading", { name: "Delete Matter" })).toBeVisible();
    // recordTitle joins the configured titleFields — just the caption here.
    await expect(dialog(page)).toContainText('delete "In re Marriage of Chen"');
    await expect(dialog(page)).toContainText("This cannot be undone.");
  });

  test("cancelling leaves the record alone", async ({ page }) => {
    let deleted = false;
    page.on("request", (r) => {
      if (r.method() === "DELETE") deleted = true;
    });

    await row(page, "In re Marriage of Chen").getByRole("button", { name: "Delete" }).click();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(3);
    expect(deleted).toBe(false);
  });

  test("confirming removes the row and updates the count", async ({ page }) => {
    await row(page, "In re Marriage of Chen").getByRole("button", { name: "Delete" }).click();

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.method() === "DELETE"),
      dialog(page).getByRole("button", { name: "Delete" }).click(),
    ]);
    expect(request.url()).toContain("/api/matters/mt-2");

    await expect(page.locator(".toast.success")).toHaveText("Matter deleted");
    await expect(rows(page)).toHaveCount(2);
    await expect(row(page, "In re Marriage of Chen")).toHaveCount(0);
    await expect(page.locator(".count-pill")).toHaveText("2 records");
  });

  test("keeps the dialog open and toasts when the delete fails", async ({ page }) => {
    await page.route("**/api/matters/*", (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "Matter has an active lease" }),
      });
    });

    await row(page, "In re Marriage of Chen").getByRole("button", { name: "Delete" }).click();
    await dialog(page).getByRole("button", { name: "Delete" }).click();

    await expect(page.locator(".toast.error")).toHaveText("Matter has an active lease");
    await expect(dialog(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(3);
  });
});

test.describe("Modal behaviour", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/matters");
    await page.getByRole("button", { name: "New Matter" }).click();
    await expect(dialog(page)).toBeVisible();
  });

  test("closes on Escape", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("closes via the header close button", async ({ page }) => {
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test("closes when the backdrop is pressed", async ({ page }) => {
    // The dialog is centred, so click a corner of the scrim rather than its
    // middle, which would land on the dialog itself.
    await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(dialog(page)).toHaveCount(0);
  });

  test("stays open when the dialog body is pressed", async ({ page }) => {
    await dialog(page).locator(".modal-head").click();
    await expect(dialog(page)).toBeVisible();
  });

  test("locks page scrolling while open", async ({ page }) => {
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("does not leak form state between modules", async ({ page }) => {
    await field(page, "matter_caption").fill("Scratch value");
    await page.keyboard.press("Escape");

    await page.locator("nav.nav").getByRole("link", { name: "Clients", exact: true }).click();
    await page.getByRole("button", { name: "New Client" }).click();
    await expect(field(page, "client_name")).toHaveValue("");

    await page.keyboard.press("Escape");
    await page.locator("nav.nav").getByRole("link", { name: "Matters", exact: true }).click();
    await page.getByRole("button", { name: "New Matter" }).click();
    await expect(field(page, "matter_caption")).toHaveValue("");
  });
});

test.describe("Cross-module CRUD", () => {
  // A second module confirms the generic form handles a different field mix —
  // a boolean and a currency amount rather than the matter form's selects.
  test("creates a cost with a boolean field", async ({ page }) => {
    await page.goto("/costs_and_disbursements");
    await page.getByRole("button", { name: "New Cost" }).click();

    await field(page, "date").fill("2026-08-20");
    await field(page, "matter_id").fill("MT-2018");
    await field(page, "description").fill("Deposition transcript - Villalobos");
    await field(page, "expense_category").selectOption("Deposition transcripts");
    await field(page, "vendor_payee").fill("Barkley Court Reporters");
    await field(page, "amount").fill("1240.55");
    await field(page, "recoverable").selectOption("true");

    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "POST" && r.url().includes("/api/costs_and_disbursements")
      ),
      dialog(page).getByRole("button", { name: "Save" }).click(),
    ]);

    expect(request.postDataJSON()).toEqual({
      date: "2026-08-20",
      matter_id: "MT-2018",
      description: "Deposition transcript - Villalobos",
      expense_category: "Deposition transcripts",
      vendor_payee: "Barkley Court Reporters",
      amount: 1240.55,
      recoverable: true,
    });
    await expect(row(page, "Barkley Court Reporters")).toBeVisible();
  });

  test("creates a lookup, whose key is one of its own fields", async ({ page }) => {
    await page.goto("/lookups");
    await page.getByRole("button", { name: "New Lookup" }).click();

    await field(page, "list").fill("Practice Area");
    await field(page, "value").fill("Construction Defect");
    await field(page, "description").fill("California construction defect litigation");

    await dialog(page).getByRole("button", { name: "Save" }).click();

    await expect(page.locator(".toast.success")).toHaveText("Lookup created");
    await expect(row(page, "Construction Defect")).toContainText("Practice Area");
  });
});
