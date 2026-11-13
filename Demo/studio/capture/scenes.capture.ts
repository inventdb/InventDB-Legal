// The film's footage. Each test is one scene: a few frames of the real app,
// named <scene>-<n>, taken as a person would move through it. Interactions are
// located by role and visible text, so a restyle does not break the capture.
import { DESCRIBE_MATTER_STEPS, sseBody } from "../../../frontend/e2e/fixtures";
import { ANALYZE_QUESTION } from "./legal-content";
import { prepare, shot, test } from "./lib";

const FEATURE = "Olympic Boulevard v. Sunset Ridge"; // MT-2441 in the demo data

test("dashboard", async ({ page }) => {
  await prepare(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shot(page, "dash-1", {}, { settle: 1500 });
  await page.mouse.wheel(0, 700);
  await shot(page, "dash-2", {}, { settle: 900 });
});

test("matters", async ({ page }) => {
  await prepare(page);
  await page.goto("/matters");
  await page.waitForLoadState("networkidle");
  await shot(page, "matters-1", {}, { settle: 1200 });
  await page.goto("/matters?view=table");
  await page.waitForLoadState("networkidle");
  await shot(page, "matters-2", {}, { settle: 1200 });
  await page.goto("/matters");
  await page.waitForLoadState("networkidle");
  const search = page.getByPlaceholder(/Search matters/i);
  await search.click();
  await page.keyboard.type("Olympic Boulevard", { delay: 40 });
  await shot(page, "matters-3", {}, { settle: 1200 });
  await page.getByText(FEATURE, { exact: true }).first().click();
  await page.waitForLoadState("networkidle");
  await shot(page, "matter-1", {}, { settle: 1500 });
  await page.mouse.wheel(0, 600);
  await shot(page, "matter-2", {}, { settle: 900 });
  await page.mouse.wheel(0, -600);
  const related = page.getByRole("tab", { name: /Related/i }).or(page.getByRole("button", { name: /^Related/i }));
  if (await related.first().isVisible().catch(() => false)) {
    await related.first().click();
    await shot(page, "matter-3", {}, { settle: 1500 });
  } else console.log("matter: no Related tab");
});

test("drill", async ({ page }) => {
  await prepare(page);
  await page.goto("/matters?view=table");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder(/Search matters/i).fill("MT-2441");
  await page.waitForTimeout(900);
  await page.locator("table tbody tr").filter({ hasText: "MT-2441" }).first().click();
  await shot(page, "drill-1", {}, { settle: 1600 });
  await page.mouse.wheel(0, 900);
  await shot(page, "drill-2", {}, { settle: 900 });
});

test("search", async ({ page }) => {
  await prepare(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Search the firm").click();
  await page.keyboard.type("Kang Brothers", { delay: 45 });
  await shot(page, "search-1", {}, { settle: 1500 });
});

test("describe", async ({ page }) => {
  await prepare(page);
  await page.route(/\/api\/analyze\/chat\/stream/, (route) =>
    route.fulfill({ status: 200, contentType: "text/event-stream", body: sseBody(DESCRIBE_MATTER_STEPS) })
  );
  await page.goto("/matters");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /New Matter/i }).first().click();
  await shot(page, "describe-1", {}, { settle: 1000 });
  const box = page.locator("#describe-record");
  await box.click();
  await page.keyboard.type(
    "New personal injury matter for Carmen Pineda: rear-end collision, opposing party Bright Path Childcare, carrier State Farm, claim 23-954458-D. Pre-suit contingency at 33 1/3%.",
    { delay: 8 }
  );
  await shot(page, "describe-2", {}, { settle: 500 });
  const go = page.getByRole("dialog").getByRole("button", { name: /Fill the form/i });
  await go.click();
  await shot(page, "describe-3", {}, { settle: 1800 });
});

test("calendar", async ({ page }) => {
  await prepare(page);
  await page.goto("/court_calendar?view=calendar");
  await page.waitForLoadState("networkidle");
  await shot(page, "cal-1", {}, { settle: 1300 });
  await page.getByText(/\+\d+ more/).first().click();
  await shot(page, "cal-2", {}, { settle: 1200 });
});

test("deadlines", async ({ page }) => {
  await prepare(page);
  await page.goto("/deadlines_and_sol?view=table");
  await page.waitForLoadState("networkidle");
  await shot(page, "deadlines-1", {}, { settle: 1200 });
});

test("money", async ({ page }) => {
  await prepare(page);
  for (const [route, name] of [
    ["/time_entries", "time-1"],
    ["/invoices", "invoices-1"],
    ["/trust_ledger_cta?view=table", "trust-1"],
    ["/settlements_and_liens", "settle-1"],
    ["/intake_and_leads", "intake-1"],
  ]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await shot(page, name, {}, { settle: 1200 });
  }
});

test("analyze", async ({ page }) => {
  await prepare(page);
  await page.goto("/analyze");
  await page.waitForLoadState("networkidle");
  const ask = page.getByPlaceholder(/Ask anything about your data/i);
  await ask.click();
  await page.keyboard.type(ANALYZE_QUESTION, { delay: 40 });
  await shot(page, "analyze-1", {}, { settle: 500 });
  await page.getByRole("button", { name: /^Ask$/ }).click();
  await shot(page, "analyze-2", {}, { settle: 2500 });
  await page.mouse.wheel(0, 500);
  await shot(page, "analyze-3", {}, { settle: 900 });
  const sql = page.getByText(/Show the query/i).first();
  if (await sql.isVisible().catch(() => false)) {
    await sql.click();
    await shot(page, "analyze-4", {}, { settle: 900 });
  }
});

test("reports", async ({ page }) => {
  await prepare(page);
  await page.goto("/reports");
  await page.waitForLoadState("networkidle");
  await shot(page, "reports-1", {}, { settle: 1500 });
  await page.getByText("Unbilled work by matter", { exact: true }).first().click();
  await shot(page, "reports-2", {}, { settle: 1500 });
  // The trust report takes an "As of" date, so it renders once that is submitted.
  await page.getByText(/^Trust balances by/).first().click();
  await page.waitForTimeout(900);
  const render = page.getByRole("button", { name: /^(Render|Run|Apply|Show)/i }).filter({ hasNotText: /instruction/i });
  if (await render.first().isVisible().catch(() => false)) await render.first().click();
  await shot(page, "reports-3", {}, { settle: 1800 });
  await page.getByPlaceholder(/Describe the change/i).click();
  await page.keyboard.type("Add a column for the responsible attorney and sort by balance", { delay: 25 });
  await shot(page, "reports-4", {}, { settle: 500 });
});

test("workflows", async ({ page }) => {
  await prepare(page);
  await page.goto("/workflows");
  await page.waitForLoadState("networkidle");
  await shot(page, "wf-1", {}, { settle: 1500 });
  await page.getByText(/Conflict check: new enquiry/).first().click();
  await shot(page, "wf-2", {}, { settle: 1200 });
  await page.getByRole("button", { name: /Show what the run has done/i }).first().click().catch(() => console.log("wf: no run trail"));
  await shot(page, "wf-3", {}, { settle: 1200 });
  await page.getByText("Morning docket alert", { exact: true }).first().click();
  await shot(page, "wf-4", {}, { settle: 1500 });
  await page.mouse.wheel(0, 700);
  await shot(page, "wf-5", {}, { settle: 900 });
});

test("files", async ({ page }) => {
  await prepare(page);
  await page.goto("/files");
  await page.waitForLoadState("networkidle");
  await shot(page, "files-1", {}, { settle: 1300 });
  await page.getByText("Engagement letter - signed.pdf").first().click();
  await shot(page, "files-2", {}, { settle: 1300 });
});

test("dark", async ({ page }) => {
  await prepare(page, { theme: "dark" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shot(page, "dark-1", {}, { settle: 1500 });
  await page.goto("/court_calendar?view=calendar");
  await page.waitForLoadState("networkidle");
  await shot(page, "dark-2", {}, { settle: 1300 });
});

test.describe("paralegal", () => {
  test.use({ access: "paralegal" });
  test("paralegal", async ({ page }) => {
    await prepare(page, { access: "paralegal" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await shot(page, "role-paralegal", {}, { settle: 1500 });
  });
});

test.describe("intake", () => {
  test.use({ access: "intake" });
  test("intake", async ({ page }) => {
    await prepare(page, { access: "intake" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await shot(page, "role-intake", {}, { settle: 1500 });
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("phone", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await shot(page, "phone-1", {}, { settle: 1500 });
    await page.goto("/court_calendar?view=calendar");
    await page.waitForLoadState("networkidle");
    await shot(page, "phone-2", {}, { settle: 1300 });
    await page.goto("/matters");
    await page.waitForLoadState("networkidle");
    await shot(page, "phone-3", {}, { settle: 1300 });
  });
});

test("booklet", async ({ page }) => {
  // desk.seen is set for a signed-out visitor too, so the opening is skipped
  // and the booklet waits at its sign-in page.
  await prepare(page, { signedIn: false });
  await page.addInitScript(() => localStorage.setItem("legal.desk.seen", "1"));
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator(".dk-intro").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
  await page.getByLabel("Username", { exact: true }).waitFor();
  await shot(page, "book-signin", {}, { settle: 1500 });
  for (let i = 6; i >= 1; i--) {
    await page.getByRole("button", { name: "Previous page" }).click();
    await shot(page, `book-ch${i}`, {}, { settle: 1600 });
  }
});
