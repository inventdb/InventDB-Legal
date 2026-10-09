import * as XLSX from "xlsx";

import { expect, test } from "./fixtures";

/**
 * A date in a spreadsheet is a day, and it must import as that day wherever
 * the browser is.
 *
 * SheetJS turns a date cell into a Date built from an 1899 epoch in local time.
 * In India that epoch's offset carried seconds (+05:21:10), so every date came
 * back seconds before midnight — Monday read as Sunday 23:59:50 — and a whole
 * practice's court dates, deadlines and invoices imported one day early. This
 * runs the import in that time zone and checks the exact days that are sent.
 */
test.use({ timezoneId: "Asia/Kolkata" });

/** Excel's day number for a calendar day (days since 1899-12-30). */
const serial = (y: number, m: number, d: number) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;

function workbook(): Buffer {
  const days: [string, number, number, number, string][] = [
    ["EV-1", 2024, 9, 16, "Status Conference"], // a Monday
    ["EV-2", 2026, 10, 2, "Mediation"], // a Friday
    ["EV-3", 2026, 12, 31, "Deposition"], // the last day of a year
    ["EV-4", 2027, 2, 28, "Arraignment"],
  ];
  const sheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([["Event ID", "Date", "Event Type"]]);
  days.forEach(([id, y, m, d, type], i) => {
    sheet[`A${i + 2}`] = { t: "s", v: id };
    sheet[`B${i + 2}`] = { t: "n", v: serial(y, m, d), z: "yyyy-mm-dd" };
    sheet[`C${i + 2}`] = { t: "s", v: type };
  });
  sheet["!ref"] = `A1:C${days.length + 1}`;
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Court Calendar");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

test("dates import as the day the sheet says, east of UTC too", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/import/**", async (route) => {
    const body = route.request().postDataJSON() as { rows?: Record<string, unknown>[] };
    sent.push(...(body?.rows ?? []));
    await route.fulfill({ json: { ok: true, created: body?.rows?.length ?? 0 } });
  });

  await page.goto("/import");
  await page.locator("input[type=file]").setInputFiles({
    name: "court-calendar.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook(),
  });
  await page.locator(".import-actions .btn-primary").click();
  await expect(page.locator(".import-result")).toBeVisible({ timeout: 30_000 });

  const byId = Object.fromEntries(sent.map((r) => [String(r.event_id), r.date]));
  expect(byId).toEqual({
    "EV-1": "2024-09-16",
    "EV-2": "2026-10-02",
    "EV-3": "2026-12-31",
    "EV-4": "2027-02-28",
  });
});
