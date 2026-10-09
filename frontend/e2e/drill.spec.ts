import type { Page, Request } from "@playwright/test";

import { expect, field, row, sseBody, test } from "./fixtures";

/**
 * The drill-down panel — the right-hand view a click on any record, result row,
 * chart mark or report row opens.
 *
 * The promises it makes, and that these specs hold it to:
 *   - a click VIEWS: the panel opens read-only, and editing is a separate,
 *     deliberate press of Edit;
 *   - Edit is only offered when the server says this person may change THIS
 *     record, and a row rule that refuses the save turns the panel read-only
 *     with the reason;
 *   - a record shows the records it points at (links up), its files, and every
 *     module that points at it (paged grids down); each opens one level deeper;
 *   - the breadcrumb names every level by its number and jumps straight back to
 *     any of them; Back / Esc step out one level at a time;
 *   - a grouped row or chart mark lists the records BEHIND it — the query's own
 *     filter narrowed to what was clicked;
 *   - a table with no query behind it (an answer's, a report's) opens the record
 *     a row's number names.
 */

const panel = (page: Page) => page.locator("aside.drill-panel");
const section = (page: Page, name: string) => panel(page).getByRole("region", { name, exact: true });
const crumbs = (page: Page) => panel(page).getByRole("navigation", { name: "Drill-down path" }).locator("li");

test.describe("module list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/matters");
    await expect(row(page, "Pineda v. Bright Path")).toBeVisible();
  });

  test("a row opens its record read-only, with what it points at and what points at it", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();

    await expect(page.getByRole("dialog", { name: "Matter details" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Pineda v. Bright Path");
    // View, not edit: no form until Edit is pressed.
    await expect(field(page, "matter_caption")).toHaveCount(0);
    await expect(panel(page).getByRole("button", { name: "Edit" })).toBeVisible();

    // Up: the client and the responsible attorney, each named.
    const details = section(page, "Details");
    await expect(details.getByRole("button", { name: /CL-1123 · Pineda, Carmen/ })).toBeVisible();
    await expect(details.getByRole("button", { name: /TK-02 · Marisol Alvarado/ })).toBeVisible();
    // Down: every module that points at this matter, each a grid of its own rows only.
    await expect(section(page, "Time Entries")).toContainText("TE-127126");
    await expect(section(page, "Costs & Disbursements")).toContainText("CO-46436");
    await expect(section(page, "Invoices")).toContainText("INV-2026-1633");
    await expect(section(page, "Invoices")).not.toContainText("INV-2026-1553"); // MT-2987's
    await expect(section(page, "Court Calendar")).toContainText("EV-09749");
    await expect(section(page, "Deadlines & SOL")).toContainText("DL-06848");
    await expect(section(page, "Intake & Leads")).toContainText("LD-3096");
    await expect(section(page, "Settlements & Liens")).toContainText("ST-0921");
    // …and a matter with no papers says so rather than showing nothing.
    await expect(section(page, "Files")).toContainText("No files attached to or filed under this matter.");
  });

  test("its files are listed — attached, or filed under its number — and open above the panel", async ({ page }) => {
    await page.route(/\/api\/drill\/matters\/mt-1\/files$/, (route) =>
      route.fulfill({
        json: {
          numbers: ["MT-2018"],
          files: [
            {
              _id: "att-9",
              attachment_id: "att-9",
              record_type: "documents",
              record_id: "_vault",
              filename: "2025-11-24 Fee Agreement - Pineda - MT-2018 - Alvarado.pdf",
              folder_path: "Alvarado & Sung LLP/Clients/Pineda, Carmen/MT-2018 Pineda v. Bright Path/01 Intake & Engagement",
              content_type: "application/pdf",
              size_bytes: 3075,
              filed_under: "MT-2018",
            },
          ],
        },
      })
    );
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();

    const files = section(page, "Files");
    await expect(files.locator(".drill-count")).toHaveText("1");
    const doc = files.getByRole("button", { name: /Fee Agreement - Pineda - MT-2018/ });
    await expect(doc).toContainText("Filed under MT-2018 · 01 Intake & Engagement");
    await doc.click();

    // The file view opens ABOVE the panel, its PDF drawn.
    const modal = page.locator(".modal-backdrop");
    await expect(modal.getByRole("heading", { name: /Fee Agreement - Pineda/ })).toBeVisible();
    await expect(modal.locator("canvas.fx-pdf-page")).toBeVisible();
    const onTop = await page.evaluate(() => {
      const r = document.querySelector(".modal-backdrop .modal")?.getBoundingClientRect();
      const hit = r ? document.elementFromPoint(r.x + r.width / 2, r.y + 30) : null;
      return !!hit?.closest(".modal-backdrop");
    });
    expect(onTop, "the file opened underneath the panel").toBe(true);

    // Esc closes the file only; the panel is still there.
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Matter details" })).toBeVisible();
  });

  test("Edit and Delete in the row act on their own, without opening the panel", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(page.getByRole("dialog", { name: "Edit Matter" })).toBeVisible();
  });

  test("Enter on a focused row opens it too", async ({ page }) => {
    await row(page, "In re Marriage of Chen").focus();
    await page.keyboard.press("Enter");
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("In re Marriage of Chen");
  });

  test("the breadcrumb names each level by its number and jumps straight back", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();
    await section(page, "Invoices").getByRole("row", { name: /INV-2026-1633/ }).click();
    await expect(page.getByRole("dialog", { name: "Invoice details" })).toBeVisible();
    await section(page, "Details").getByRole("button", { name: /CL-1123/ }).click();
    await expect(page.getByRole("dialog", { name: "Client details" })).toBeVisible();

    await expect(crumbs(page)).toHaveText(["Matter MT-2018", "Invoice INV-2026-1633", "Client CL-1123"]);
    // The level on screen is not a link; the earlier ones are.
    await expect(crumbs(page).last().getByRole("button")).toHaveCount(0);
    await expect(crumbs(page).last().locator("[aria-current=page]")).toHaveText("Client CL-1123");

    // Straight back to the first level, two at once.
    await crumbs(page).first().getByRole("button", { name: "Matter MT-2018" }).click();
    await expect(page.getByRole("dialog", { name: "Matter details" })).toBeVisible();
    await expect(crumbs(page)).toHaveText(["Matter MT-2018"]);
  });

  test("drills deeper, and Back / Esc step out one level at a time", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();
    await section(page, "Time Entries").getByRole("row", { name: /TE-127126/ }).click();
    await expect(page.getByRole("dialog", { name: "Time Entry details" })).toBeVisible();

    await section(page, "Details").getByRole("button", { name: /TK-16/ }).click();
    await expect(page.getByRole("dialog", { name: "Timekeeper details" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Guadalupe Ramirez");

    await panel(page).getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("dialog", { name: "Time Entry details" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Matter details" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
  });

  test("the section links jump to a section below the fold", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();
    const jump = panel(page).getByRole("navigation", { name: "Sections" });
    await expect(jump.getByRole("button")).toHaveText([
      "Details",
      "Files",
      "Time Entries",
      "Costs & Disbursements",
      "Invoices",
      "Payments & Receipts",
      "Trust Ledger (CTA)",
      "Court Calendar",
      "Deadlines & SOL",
      "Intake & Leads",
      "Settlements & Liens",
    ]);
    await jump.getByRole("button", { name: "Settlements & Liens" }).click();
    await expect(section(page, "Settlements & Liens")).toBeInViewport();
  });

  test("a client lists every matter it holds, and each opens", async ({ page }) => {
    await row(page, "In re Marriage of Chen").getByText("MT-2987").click();
    await section(page, "Details").getByRole("button", { name: /CL-1932/ }).click();

    await expect(page.getByRole("dialog", { name: "Client details" })).toBeVisible();
    const matters = section(page, "Matters");
    await expect(matters.locator(".drill-count")).toHaveText("1");
    await expect(section(page, "Invoices")).toContainText("INV-2026-1553");
    await matters.getByRole("row", { name: /MT-2987/ }).click();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("In re Marriage of Chen");
  });

  test("related grids page through everything on the server", async ({ page, store }) => {
    for (let i = 0; i < 7; i++) {
      store.time_entries.push({
        _id: `te-x${i}`,
        time_entry_id: `TE-90${i}`,
        date: `2026-0${(i % 9) + 1}-01`,
        matter_id: "MT-2018",
        narrative: `Extra entry ${i}`,
        hours: 0.5,
      });
    }
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();

    const entries = section(page, "Time Entries");
    await expect(entries.locator(".drill-count")).toHaveText("8");
    await expect(entries.locator("tbody tr")).toHaveCount(5);
    await expect(entries).toContainText("1–5 of 8");
    await entries.getByRole("button", { name: "Next page" }).click();
    await expect(entries).toContainText("6–8 of 8");
    await expect(entries.locator("tbody tr")).toHaveCount(3);
  });

  test("clicking outside closes it", async ({ page }) => {
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();
    await expect(panel(page)).toBeVisible();
    await page.mouse.click(20, 400);
    await expect(panel(page)).toHaveCount(0);
  });
});

test.describe("view, then edit only where allowed", () => {
  test("an editor edits in the panel and sees the change", async ({ page, store }) => {
    await page.goto("/matters");
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();
    await panel(page).getByRole("button", { name: "Edit" }).click();

    await expect(field(page, "matter_caption")).toHaveValue("Pineda v. Bright Path");
    await field(page, "matter_caption").fill("Pineda v. Bright Path Learning Center");
    await panel(page).getByRole("button", { name: "Save" }).click();

    await expect(page.locator(".toast.success")).toHaveText("Matter updated");
    await expect(field(page, "matter_caption")).toHaveCount(0); // back to view
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Pineda v. Bright Path Learning Center");
    expect(store.matters.find((m) => m._id === "mt-1")?.matter_caption).toBe("Pineda v. Bright Path Learning Center");
  });

  test("a reader gets the record without an Edit button", async ({ page }) => {
    await page.route(/\/api\/drill\/[^/]+\/[^/]+\/access$/, (route) =>
      route.fulfill({
        json: { can_view: true, can_edit: false, reason: "You can view matters but not change them.", row_rules: "n/a" },
      })
    );
    await page.goto("/matters");
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();

    await expect(panel(page).getByText("View only — You can view matters but not change them.")).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Edit" })).toHaveCount(0);
  });

  test("a row rule that refuses the save turns the record read-only, with its reason", async ({ page, store }) => {
    const reason = "Row-level rule denies write on legal.matters for this record (none of your grants' row rules match it).";
    await page.route(/\/api\/matters\/mt-1$/, (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 403, json: { ok: false, error: reason } })
        : route.fallback()
    );
    await page.goto("/matters");
    await row(page, "Pineda v. Bright Path").getByText("MT-2018").click();
    await panel(page).getByRole("button", { name: "Edit" }).click();
    await field(page, "matter_caption").fill("Somebody else's matter");
    await panel(page).getByRole("button", { name: "Save" }).click();

    await expect(panel(page).getByText(`View only — ${reason}`)).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Edit" })).toHaveCount(0);
    expect(store.matters.find((m) => m._id === "mt-1")?.matter_caption).toBe("Pineda v. Bright Path");
  });

  test("a record hidden from this person says so instead of failing", async ({ page }) => {
    await page.goto("/invoices?focus=inv-gone");
    await expect(panel(page).getByRole("alert")).toContainText("isn't available");
  });
});

test.describe("links into a record", () => {
  test("?focus= opens the record in the panel, not an edit form", async ({ page }) => {
    await page.goto("/invoices?focus=inv-1");
    await expect(page.getByRole("dialog", { name: "Invoice details" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("In re Marriage of Chen");
    await expect(field(page, "invoice_no")).toHaveCount(0);
    await expect(page).toHaveURL(/\/invoices$/); // consumed
  });

  test("leaving the page puts the panel away", async ({ page }) => {
    await page.goto("/matters");
    await page.locator("nav.nav").getByRole("link", { name: "Invoices" }).click();
    await row(page, "INV-2026-1553").getByText("INV-2026-1553").click();
    await expect(panel(page)).toBeVisible();
    // The backdrop covers the sidebar, so Back is the way off the page.
    await page.goBack();
    await expect(page).toHaveURL(/\/matters$/);
    await expect(panel(page)).toHaveCount(0);
  });
});

/* ── Analyze ─────────────────────────────────────────────────────────────── */

async function scriptTurn(page: Page, steps: Record<string, unknown>[]) {
  await page.route(/\/api\/analyze\/chat\/stream/, (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: sseBody(steps) })
  );
}

async function ask(page: Page, question: string) {
  await page.locator(".an-ask .an-composer-input").fill(question);
  await page.locator(".an-ask button[type=submit]").click();
}

function drillBodies(page: Page): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = [];
  page.on("request", (r: Request) => {
    if (r.method() === "POST" && /\/api\/drill\/[a-z_]+$/.test(r.url())) {
      bodies.push({ entity: r.url().split("/").pop(), ...(r.postDataJSON() as object) });
    }
  });
  return bodies;
}

const GROUPED_SQL = "SELECT status, COUNT(*) AS n FROM legal.matters WHERE practice_area <> '' GROUP BY status";

test.describe("Analyze", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/analyze");
  });

  test("a grouped row lists the records behind it", async ({ page }) => {
    const bodies = drillBodies(page);
    await scriptTurn(page, [
      { type: "sql", content: "Executing query...", sql: GROUPED_SQL },
      { type: "result", content: "2 rows", sql: GROUPED_SQL, data: [{ status: "Open", n: 2 }, { status: "Closed", n: 1 }] },
      { type: "done", content: "Two open and one closed." },
    ]);
    await ask(page, "Matters by status");

    await expect(page.getByText("click a row to see what is behind it")).toBeVisible();
    await page.locator(".an-table tbody tr", { hasText: "Open" }).click();

    await expect(page.getByRole("dialog", { name: "Behind this number" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Matters · Open");
    await expect(panel(page).locator("tbody tr")).toHaveCount(2);
    await expect(panel(page)).toContainText("Pineda v. Bright Path");
    // The query's own filter, narrowed to the group clicked.
    expect(bodies.at(-1)).toMatchObject({ entity: "matters", where: "(practice_area <> '') AND status = 'Open'" });

    // …and each record behind it opens one level deeper.
    await panel(page).getByRole("row", { name: /MT-2018/ }).click();
    await expect(page.getByRole("dialog", { name: "Matter details" })).toBeVisible();
    await expect(crumbs(page)).toHaveText(["Matters · Open", "Matter MT-2018"]);
  });

  test("a chart bar lists the records behind it", async ({ page }) => {
    const bodies = drillBodies(page);
    await scriptTurn(page, [
      { type: "sql", content: "Executing query...", sql: GROUPED_SQL },
      { type: "result", content: "2 rows", sql: GROUPED_SQL, data: [{ status: "Open", n: 2 }, { status: "Closed", n: 1 }] },
      {
        type: "chart",
        content: "Matters by status",
        chart: { data: [{ type: "bar", x: ["Open", "Closed"], y: [2, 1] }], layout: { title: "Matters by status" } },
      },
      { type: "done", content: "Charted." },
    ]);
    await ask(page, "Chart matters by status");

    const figure = page.locator(".an-figure");
    await expect(figure.getByText("Click a bar to see the records behind it.")).toBeVisible();
    await figure.locator(".recharts-bar-rectangle").nth(1).click();

    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Matters · Closed");
    await expect(panel(page)).toContainText("In re Zhang");
    expect(bodies.at(-1)).toMatchObject({ where: "(practice_area <> '') AND status = 'Closed'" });
  });

  test("a record row opens that record", async ({ page }) => {
    const sql = "SELECT _id, invoice_no, status FROM legal.invoices WHERE status = 'Open'";
    await scriptTurn(page, [
      { type: "result", content: "1 row", sql, data: [{ _id: "inv-2", invoice_no: "INV-2026-1633", status: "Open" }] },
      { type: "done", content: "One." },
    ]);
    await ask(page, "Open invoices");

    await expect(page.getByText("click a row to open it")).toBeVisible();
    await page.locator(".an-table tbody tr", { hasText: "INV-2026-1633" }).click();
    await expect(page.getByRole("dialog", { name: "Invoice details" })).toBeVisible();
    await expect(section(page, "Details").getByRole("button", { name: /MT-2018/ })).toBeVisible();
  });

  test("a joined result maps to no single module, so it isn't clickable", async ({ page }) => {
    const sql =
      "SELECT i.invoice_no, m.practice_area FROM legal.invoices i JOIN legal.matters m ON i.matter_id = m.matter_id";
    await scriptTurn(page, [
      {
        type: "result",
        content: "2 rows",
        sql,
        data: [
          { invoice_no: "INV-2026-1553", practice_area: "Family Law" },
          { invoice_no: "INV-2026-1633", practice_area: "Personal Injury" },
        ],
      },
      { type: "done", content: "Two." },
    ]);
    await ask(page, "Invoices with practice areas");

    await expect(page.locator(".an-table tbody tr")).toHaveCount(2);
    await expect(page.locator(".an-table tbody tr.is-clickable")).toHaveCount(0);
    await page.locator(".an-table tbody tr").first().click();
    await expect(panel(page)).toHaveCount(0);
  });

  test("a table in the answer opens the record a row's number names", async ({ page }) => {
    await scriptTurn(page, [
      {
        type: "done",
        content:
          "These two matters need attention:\n\n| Matter | Caption | Why |\n|---|---|---|\n" +
          "| MT-2987 | In re Marriage of Chen | Disclosure due |\n| — | (no matter yet) | A prospect |",
      },
    ]);
    await ask(page, "Which matters need attention?");

    const table = page.locator(".an-table");
    await expect(table.locator("tbody tr.is-clickable")).toHaveCount(1); // the row without a number stays put
    await table.locator("tbody tr", { hasText: "MT-2987" }).click();
    await expect(page.getByRole("dialog", { name: "Matter details" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("In re Marriage of Chen");
  });
});

/* ── Dashboard ───────────────────────────────────────────────────────────── */

test.describe("Dashboard", () => {
  const WIDGETS = [
    { kind: "kpi", title: "Open Matters", sql: "SELECT COUNT(*) AS v FROM legal.matters WHERE status = 'Open'", span: 3 },
    { kind: "pie", title: "Matters by Status", sql: "SELECT status, COUNT(*) AS v FROM legal.matters GROUP BY status", span: 6 },
  ];

  test.beforeEach(async ({ page }) => {
    // Every widget's query answers with the matters' statuses.
    await page.route(/\/api\/meta\/sql$/, (route) =>
      /legal\.dashboards/i.test(String(route.request().postDataJSON()?.sql ?? ""))
        ? route.fallback()
        : route.fulfill({ json: { rows: [{ status: "Open", v: 2 }, { status: "Closed", v: 1 }] } })
    );
    await page.route(/\/api\/analyze\/chat\/stream/, (route) =>
      route.fulfill({ status: 200, contentType: "text/event-stream", body: sseBody([{ type: "answer", content: JSON.stringify(WIDGETS) }]) })
    );
    await page.goto("/");
    await page.getByRole("button", { name: /New layout/ }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#w-layout").fill("practice");
    await dialog.getByRole("button", { name: /Build layout/ }).click();
    await dialog.getByRole("button", { name: "Replace my dashboard" }).click();
    await expect(page.getByRole("heading", { name: "Open Matters" })).toBeVisible();
  });

  test("a KPI lists every record behind the number", async ({ page }) => {
    await page.getByTitle("See the records behind this number").click();
    await expect(page.getByRole("dialog", { name: "Behind this number" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Open Matters");
    await expect(panel(page).locator("tbody tr")).toHaveCount(2);
    await expect(panel(page)).toContainText("Pineda v. Bright Path");
  });

  test("a slice lists the records in that group", async ({ page }) => {
    await page.locator(".wg-legend-row").nth(1).click();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Matters · Closed");
    await expect(panel(page).locator("tbody tr")).toHaveCount(1);
    await expect(panel(page)).toContainText("In re Zhang");
  });

  test("nothing drills while the layout is being edited", async ({ page }) => {
    await page.getByRole("button", { name: "Edit layout" }).click();
    await expect(page.getByTitle("See the records behind this number")).toHaveCount(0);
    await page.locator(".wg-legend-row").nth(1).click();
    await expect(panel(page)).toHaveCount(0);
  });
});

/* ── Report Studio ───────────────────────────────────────────────────────── */

test.describe("Reports", () => {
  test("a report row carrying a record number opens that record", async ({ page }) => {
    await page.route(/\/api\/reports\/templates\/rpt-rent-roll\/render$/, (route) =>
      route.fulfill({
        json: {
          html:
            "<html><body><h1>Aged Receivables</h1><table><thead><tr><th>Invoice</th><th>Balance</th></tr></thead>" +
            "<tbody><tr><td>INV-2026-1553</td><td>$0.00</td></tr><tr><td>Unapplied</td><td>$12.00</td></tr></tbody></table></body></html>",
          meta: { elapsed_ms: 40, mode: "sql", bytes: 256 },
        },
      })
    );
    await page.goto("/reports");
    await page.locator(".rs-row").filter({ hasText: "Rent Roll" }).first().locator(".rs-row-open").click();

    const frame = page.frameLocator("iframe.report-frame");
    await expect(frame.getByRole("heading", { name: "Aged Receivables" })).toBeVisible();
    // Only the row that names a record is offered.
    await expect(frame.locator("tr[data-record-number]")).toHaveCount(1);
    await frame.getByRole("cell", { name: "INV-2026-1553" }).click();

    await expect(page.getByRole("dialog", { name: "Invoice details" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("In re Marriage of Chen");
    await expect(crumbs(page)).toHaveText(["Invoice INV-2026-1553"]);
  });
});
