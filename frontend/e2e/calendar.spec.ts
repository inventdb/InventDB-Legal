import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * The court calendar's calendar view — the month on a desktop, the agenda on a
 * phone.
 *
 * What it promises: only the month and its events; a day never shows more
 * than it has room for, and the rest of a busy day is one click away; an event
 * opens in the drill-down panel like a table row; the page's search narrows it;
 * and the month you are on survives a reload.
 */

const TODAY = new Date(2026, 9, 14, 10, 0, 0); // Wednesday 14 October 2026

const event = (n: number, date: string, time: string, type: string, inCourt = true) => ({
  _id: `ev-x${n}`,
  event_id: `EV-1${String(n).padStart(4, "0")}`,
  date,
  time,
  matter_id: "MT-2018",
  matter_caption: "Pineda v. Bright Path",
  event_type: type,
  in_court: inCourt,
  court_location: "LASC Stanley Mosk",
  department: "Dept. 56",
});

const day = (page: Page, d: number) => page.getByRole("gridcell", { name: new RegExp(`^\\w+day, October ${d}, 2026`) });
const panel = (page: Page) => page.locator("aside.drill-panel");

test.beforeEach(async ({ page, store }) => {
  await page.clock.setFixedTime(TODAY);
  // A busy Wednesday (five events), and a quiet Friday.
  store.court_calendar.push(
    event(1, "2026-10-14", "13:30", "Mediation", false),
    event(2, "2026-10-14", "08:30", "Demurrer Hearing"),
    event(3, "2026-10-14", "10:30", "Status Conference"),
    event(4, "2026-10-14", "09:00", "Case Management Conference"),
    event(5, "2026-10-14", "15:00", "Deposition", false),
    event(6, "2026-10-16", "08:30", "Arraignment")
  );
});

test("the court calendar offers a calendar beside its table, other modules do not", async ({ page }) => {
  await page.goto("/court_calendar");
  const mode = page.getByRole("group", { name: "Show as" });
  await expect(mode.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
  await mode.getByRole("button", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/view=calendar/);
  await expect(page.locator(".cal-title")).toHaveText("October 2026");
  await expect(page.locator("table.data")).toHaveCount(0);
  await expect(page.locator(".pager")).toHaveCount(0);
  await expect(page.locator(".count-pill")).toHaveText("7 this month");

  await page.goto("/matters");
  await expect(page.getByRole("group", { name: "Show as" })).toHaveCount(0);
});

test("a day shows its events in time order, and one opens in the panel", async ({ page }) => {
  await page.goto("/court_calendar?view=calendar&month=2026-10");
  const friday = day(page, 16);
  await expect(friday.locator(".cal-chip")).toHaveText(["8:30aArraignment"]);
  // The fixture's 19 October deposition is out of court: told apart by colour only.
  await expect(day(page, 19).locator(".cal-chip.tone-no")).toHaveCount(1);

  await friday.getByRole("button", { name: /Arraignment/ }).click();
  await expect(page.getByRole("dialog", { name: "Court Event details" })).toBeVisible();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Arraignment");
});

test("a busy day shows two and folds the rest into +N more, which lists the whole day by time", async ({ page }) => {
  await page.goto("/court_calendar?view=calendar&month=2026-10");
  const busy = day(page, 14);
  await expect(busy).toHaveClass(/is-today/);
  await expect(busy.locator(".cal-chip")).toHaveText(["8:30aDemurrer Hearing", "9aCase Management Conference"]);
  await busy.getByRole("button", { name: "+3 more" }).click();

  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Wednesday, October 14, 2026");
  const rows = panel(page).locator("tbody tr");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("08:30");
  await expect(rows.last()).toContainText("15:00");
  // …and each opens one level deeper.
  await rows.nth(2).click();
  await expect(page.getByRole("dialog", { name: "Court Event details" })).toBeVisible();
});

test("no day ever shows more than three events", async ({ page }) => {
  await page.goto("/court_calendar?view=calendar&month=2026-10");
  await expect(day(page, 14).locator(".cal-chip")).toHaveCount(2);
  const most = await page.locator(".cal-day").evaluateAll((cells) => Math.max(...cells.map((c) => c.querySelectorAll(".cal-chip").length)));
  expect(most).toBeLessThanOrEqual(3);
});

test("the arrows and Today move the month, and the URL keeps it", async ({ page }) => {
  await page.goto("/court_calendar?view=calendar");
  await expect(page.locator(".cal-title")).toHaveText("October 2026");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".cal-title")).toHaveText("November 2026");
  await expect(page).toHaveURL(/month=2026-11/);

  await page.reload();
  await expect(page.locator(".cal-title")).toHaveText("November 2026");

  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.locator(".cal-title")).toHaveText("September 2026");
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.locator(".cal-title")).toHaveText("October 2026");
});

test("the page's search narrows the calendar, and a day's list too", async ({ page }) => {
  await page.goto("/court_calendar?view=calendar&month=2026-10");
  await page.getByPlaceholder("Search court calendar…").fill("deposition");
  await expect(day(page, 16).locator(".cal-chip")).toHaveCount(0);
  await expect(day(page, 14).locator(".cal-chip")).toHaveText(["3pDeposition"]);
  await expect(page.locator(".count-pill")).toHaveText("2 this month");

  // The day's own list is searched the same way.
  await day(page, 14).locator("button.cal-date").click();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Wednesday, October 14, 2026");
  await expect(panel(page).locator("tbody tr")).toHaveCount(1);
  await expect(panel(page).locator("tbody tr")).toContainText("Deposition");
});

test("Table goes back to the table", async ({ page }) => {
  await page.goto("/court_calendar?view=calendar&month=2026-10");
  await page.getByRole("group", { name: "Show as" }).getByRole("button", { name: "Table" }).click();
  await expect(page.locator("table.data")).toBeVisible();
  await expect(page).not.toHaveURL(/view=calendar/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the month becomes an agenda of the days that have something", async ({ page }) => {
    await page.goto("/court_calendar?view=calendar&month=2026-10");
    await expect(page.locator(".cal-month")).toHaveCount(0);
    const days = page.locator(".cal-agenda-day");
    await expect(days).toHaveCount(3); // the 14th, 16th and 19th
    const today = days.first();
    await expect(today.locator(".cal-agenda-today")).toHaveText("Today");
    await expect(today.locator(".cal-agenda-time")).toHaveText(["8:30 AM", "9:00 AM", "10:30 AM", "1:30 PM", "3:00 PM"]);
    await expect(today.locator(".cal-agenda-event").first()).toContainText("Pineda v. Bright Path");
    await expect(today.locator(".cal-agenda-event").first()).toContainText("LASC Stanley Mosk · Dept. 56");

    // Nothing runs off the side.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await today.locator(".cal-agenda-event").first().click();
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Demurrer Hearing");
  });

  test("an empty month says so", async ({ page }) => {
    await page.goto("/court_calendar?view=calendar&month=2027-03");
    await expect(page.locator(".cal-empty")).toHaveText("Nothing on the calendar in March 2027.");
  });
});
