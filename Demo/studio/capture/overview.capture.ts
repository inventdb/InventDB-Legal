// First pass: every section once, signed in as the managing partner, so the
// storyboard can be planned against what the screens actually show.
import { prepare, shot, test } from "./lib";

const ROUTES: [string, string][] = [
  ["/", "ov-dashboard"],
  ["/matters", "ov-matters"],
  ["/matters?view=table", "ov-matters-table"],
  ["/clients", "ov-clients"],
  ["/time_entries", "ov-time"],
  ["/invoices", "ov-invoices"],
  ["/trust_ledger_cta", "ov-trust"],
  ["/court_calendar?view=calendar", "ov-calendar"],
  ["/deadlines_and_sol", "ov-deadlines"],
  ["/intake_and_leads", "ov-intake"],
  ["/settlements_and_liens", "ov-settlements"],
  ["/files", "ov-files"],
  ["/reports", "ov-reports"],
  ["/analyze", "ov-analyze"],
  ["/workflows", "ov-workflows"],
];

for (const [route, name] of ROUTES) {
  test(`overview ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await prepare(page);
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await shot(page, name, {}, { settle: 1500 });
    if (errors.length) console.log(name, "ERRORS", errors.join(" | "));
  });
}

test("overview sign-in desk", async ({ page }) => {
  await prepare(page, { signedIn: false });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await shot(page, "ov-login-0", {}, { settle: 1200 });
  await page.waitForTimeout(4000);
  await shot(page, "ov-login-1", {}, { settle: 200 });
});
