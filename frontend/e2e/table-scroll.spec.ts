import type { Page, Route } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * The sideways-scroll rail (`ScrollX`).
 *
 * A wide table's own scrollbar sits under its last row, so reaching it on a
 * fifty-row list means leaving the rows you are reading — and in a narrow
 * window, where the table overflows most, that walk is longest. These cover the
 * scrollbar above the table: that it appears exactly when there is something to
 * scroll, that the thumb reports and reaches the whole range by drag, click and
 * keyboard, and that it stays put wherever you are in the list.
 */

/** Roughly a split-screen half — the case that started this. */
const NARROW = { width: 760, height: 720 };
/** The project's own desktop size, i.e. the app not split at all. */
const FULL = { width: 1440, height: 900 };
/** Wide enough that even the wide seed below has nothing left to scroll. */
const ROOMY = { width: 2400, height: 900 };

/** The first row's caption and stage under the `wide` seed. */
const WIDE_CAPTION = "Chandrasekharpurbhubaneswar1 v. Thiruvananthapuram";
const WIDE_STAGE = "Prelitigationdemandoutstanding1";

const rail = ".hscroll-rail";
const thumb = ".hscroll-thumb";
const view = ".table-wrap";

/**
 * A matters list of a given length and column width.
 *
 * `wide` seeds unbreakable tokens, because a table cell wraps: what pushes a
 * table past its container is the widest thing that cannot be broken, not the
 * longest sentence. Long ids, emails and reference codes do this in real data.
 */
async function seedMatters(page: Page, count: number, wide = false) {
  await page.route("**/api/matters*", async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const items = Array.from({ length: count }, (_, i) => ({
      _id: `m-${i + 1}`,
      matter_id: wide ? `MATTER-REFERENCE-NUMBER-${i + 1}` : `MT-${2000 + i}`,
      matter_caption: wide
        ? `Chandrasekharpurbhubaneswar${i + 1} v. Thiruvananthapuram`
        : `Pineda v. Bright Path ${i + 1}`,
      client_id: "CL-1123",
      client_name: wide ? `Thiruvananthapuramcity${i + 1}` : "Pineda, Carmen",
      practice_area: wide ? `Probateandtrustadministration${i + 1}` : "Personal Injury",
      status: "Open",
      stage: wide ? `Prelitigationdemandoutstanding${i + 1}` : "Written Discovery",
      fee_model: wide ? `Statutorycontingencywcab${i + 1}` : "Contingency",
      case_number: wide ? `CASE-NUMBER-REFERENCE-${i + 1}` : `24STCV0${i + 1}`,
      date_opened: "2025-12-22",
      responsible_attorney_name: wide
        ? `Responsibleattorneyname${i + 1}`
        : "Marisol Alvarado",
      next_court_date: "2026-10-19",
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, total: count, limit: 1000, offset: 0 }),
    });
  });
}

/** How far the table can still be scrolled sideways. */
const maxScroll = (page: Page) =>
  page.locator(view).evaluate((el: Element) => el.scrollWidth - el.clientWidth);

const scrollLeft = (page: Page) =>
  page.locator(view).evaluate((el: Element) => Math.round(el.scrollLeft));

const box = async (page: Page, selector: string) =>
  (await page.locator(selector).boundingBox())!;

/** The thumb sits inside the track's 1px border, so the edges differ by that. */
const TRACK_BORDER = 1;

/** Open /matters with a table too wide for the window. */
async function openWideList(page: Page, size = NARROW, rows = 12) {
  await seedMatters(page, rows, true);
  await page.setViewportSize(size);
  await page.goto("/matters");
  await expect(page.locator(rail)).toBeVisible();
}

test.describe("Sideways scrolling", () => {
  // Split view is where the table overflows most, but a wide enough table
  // overflows at any size — the rail has to be there for both.
  for (const [where, size] of [
    ["a split-screen window", NARROW],
    ["the full desktop window", FULL],
  ] as const) {
    test(`puts a rail above the table in ${where}`, async ({ page }) => {
      await openWideList(page, size);

      expect(await maxScroll(page)).toBeGreaterThan(0);
      // Above the rows, which is the whole point — the table's own bar is
      // below them.
      const track = await box(page, rail);
      expect(track.y).toBeLessThan((await box(page, view)).y);
      // At full height. Beside a table a thousand pixels tall it is the
      // obvious thing for a layout to squash, and a hairline cannot be
      // grabbed.
      expect(track.height).toBeGreaterThanOrEqual(10);
      expect((await box(page, thumb)).height).toBeGreaterThanOrEqual(6);
    });
  }

  test("leaves no rail behind when the table already fits", async ({ page }) => {
    await seedMatters(page, 12, true);
    await page.setViewportSize(ROOMY);
    await page.goto("/matters");
    await expect(page.locator("table.data")).toBeVisible();

    expect(await maxScroll(page)).toBeLessThanOrEqual(1);
    // A scrollbar for content that already fits is a control that does nothing.
    await expect(page.locator(rail)).toHaveCount(0);
  });

  test("appears the moment the window is split, without a reload", async ({ page }) => {
    await seedMatters(page, 12, true);
    await page.setViewportSize(ROOMY);
    await page.goto("/matters");
    await expect(page.locator("table.data")).toBeVisible();
    await expect(page.locator(rail)).toHaveCount(0);

    // Dragging the window narrow is the gesture this was reported from, and it
    // changes nothing React re-renders — the measurement has to come from the
    // element itself.
    await page.setViewportSize(NARROW);
    await expect(page.locator(rail)).toBeVisible();

    await page.setViewportSize(ROOMY);
    await expect(page.locator(rail)).toHaveCount(0);
  });

  test("sizes the thumb to how much of the table is off screen", async ({ page }) => {
    await openWideList(page);

    const { visible, total } = await page.locator(view).evaluate((el: Element) => ({
      visible: el.clientWidth,
      total: el.scrollWidth,
    }));
    const t = await box(page, thumb);
    const track = await box(page, rail);

    // A thumb that does not report the proportion is just a button.
    expect(t.width / track.width).toBeCloseTo(visible / total, 1);
    expect(t.x).toBeCloseTo(track.x + TRACK_BORDER, 0);
  });

  test("reaches the last column when the thumb is dragged to the end", async ({
    page,
  }) => {
    await openWideList(page);
    const max = await maxScroll(page);
    expect(max).toBeGreaterThan(0);

    const t = await box(page, thumb);
    const track = await box(page, rail);
    const y = t.y + t.height / 2;
    await page.mouse.move(t.x + t.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(track.x + track.width + 50, y, { steps: 10 });
    await page.mouse.up();

    expect(await scrollLeft(page)).toBe(max);
    await expect(page.getByRole("columnheader", { name: "Actions" })).toBeInViewport();
    // And the thumb finishes flush with the end of its track, so there is no
    // travel left suggesting there is more to see.
    const end = await box(page, thumb);
    expect(end.x + end.width).toBeCloseTo(track.x + track.width - TRACK_BORDER, 0);

    // Back the other way.
    await page.mouse.move(end.x + end.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(track.x - 50, y, { steps: 10 });
    await page.mouse.up();

    expect(await scrollLeft(page)).toBe(0);
    await expect(page.getByRole("columnheader", { name: "Caption" })).toBeInViewport();
  });

  test("keeps the thumb under the cursor mid-drag", async ({ page }) => {
    await openWideList(page);
    const hidden = await maxScroll(page);
    const track = await box(page, rail);
    const t = await box(page, thumb);

    // Half the thumb's travel should be half the table's — the two ranges are
    // different lengths, so a drag pixel has to be worth more than a content
    // pixel. Get that wrong and the thumb slides out from under your cursor.
    const travel = track.width - 2 * TRACK_BORDER - t.width;
    const delta = Math.round(travel / 2);
    const y = t.y + t.height / 2;
    await page.mouse.move(t.x + t.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2 + delta, y, { steps: 8 });

    expect(Math.abs((await scrollLeft(page)) - hidden / 2)).toBeLessThan(4);
    expect((await box(page, thumb)).x - t.x).toBeCloseTo(delta, 0);

    await page.mouse.up();
  });

  test("jumps to a spot when the bare track is pressed", async ({ page }) => {
    await openWideList(page);
    const track = await box(page, rail);

    await page.mouse.click(track.x + track.width - 4, track.y + track.height / 2);

    expect(await scrollLeft(page)).toBe(await maxScroll(page));
  });

  test("can be driven from the keyboard", async ({ page }) => {
    await openWideList(page);
    const max = await maxScroll(page);

    await page.locator(rail).focus();
    await page.keyboard.press("End");
    expect(await scrollLeft(page)).toBe(max);

    await page.keyboard.press("Home");
    expect(await scrollLeft(page)).toBe(0);

    await page.keyboard.press("ArrowRight");
    expect(await scrollLeft(page)).toBe(60);

    // Announced as a scrollbar over its region, not as an unlabelled div.
    await expect(page.locator(rail)).toHaveAttribute("role", "scrollbar");
    await expect(page.locator(rail)).toHaveAttribute("aria-orientation", "horizontal");
  });

  test("follows along when the table itself is scrolled", async ({ page }) => {
    await openWideList(page);
    const track = await box(page, rail);
    const start = await box(page, thumb);

    // A trackpad swipe or shift-wheel over the rows scrolls the table directly;
    // the thumb has to follow, or it would report the wrong position.
    await page.locator(view).evaluate((el: Element) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect
      .poll(async () => (await box(page, thumb)).x)
      .toBeGreaterThan(start.x);

    const end = await box(page, thumb);
    expect(end.x + end.width).toBeCloseTo(track.x + track.width - TRACK_BORDER, 0);
  });

  test("stays put at the bottom of a long list", async ({ page }) => {
    await openWideList(page, NARROW, 60);
    const before = await box(page, rail);

    await page.locator(view).evaluate((el: Element) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(() => page.locator(view).evaluate((el: Element) => el.scrollTop))
      .toBeGreaterThan(400);

    // The rows move under it; the rail does not move at all. That is what
    // saves the trip to the end of the list.
    expect((await box(page, rail)).y).toBe(before.y);

    // And still wired up from down there.
    await page.mouse.click(before.x + before.width - 4, before.y + before.height / 2);
    expect(await scrollLeft(page)).toBeGreaterThan(0);
  });

  test("absorbs the overflow instead of widening the page", async ({ page }) => {
    await openWideList(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("goes away when a search narrows the table back down", async ({ page }) => {
    // Opened at full width: matters carries eleven columns, so a narrowed list
    // still overflows a split-screen window and the rail would be right to
    // stay. The window has to be one where the short table genuinely fits, or
    // the test proves nothing about the content.
    await openWideList(page, FULL);

    // Re-measured from the content, not just the window: a filtered list is a
    // different width even though nothing about the viewport changed.
    await page.route("**/api/matters*", async (route: Route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [{ _id: "m-1", matter_id: "MT-1", matter_caption: "A", client_name: "B" }],
          total: 1,
          limit: 1000,
          offset: 0,
        }),
      });
    });
    await page.getByPlaceholder("Search matters…").fill("A");

    await expect(page.locator("table.data tbody tr")).toHaveCount(1);
    await expect(page.locator(rail)).toHaveCount(0);
  });

  test("covers the files list on the same terms", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/files");
    await expect(page.locator("table.fx-table")).toBeVisible();

    const overflows = await page
      .locator(".hscroll-view")
      .first()
      .evaluate((el: Element) => el.scrollWidth - el.clientWidth > 1);
    // Four columns, so whether it overflows depends on the filenames. The
    // contract is that the rail tracks that answer, not that it is always on.
    await expect(page.locator(rail)).toHaveCount(overflows ? 1 : 0);
  });
});

/**
 * Locked column heads.
 *
 * Scrolling a long list used to take the column names off the top of the
 * screen, leaving a wall of values with nothing saying which column was which.
 * The head is `position: sticky`, which only works because the table — not the
 * page — is what scrolls on a module list.
 */
const head = (page: Page, name: string) =>
  page.getByRole("columnheader", { name, exact: true });

test.describe("Locked column heads", () => {
  test("keeps the column names in place while the rows scroll", async ({ page }) => {
    await openWideList(page, NARROW, 60);
    const before = (await head(page, "Caption").boundingBox())!.y;
    await expect(page.getByText(WIDE_CAPTION, { exact: true })).toBeVisible();

    await page.locator(view).evaluate((el: Element) => {
      el.scrollTop = 900;
    });

    // The rows moved; the names did not.
    await expect(page.getByText(WIDE_CAPTION, { exact: true })).not.toBeInViewport();
    await expect(head(page, "Caption")).toBeVisible();
    expect((await head(page, "Caption").boundingBox())!.y).toBe(before);
  });

  test("holds the head opaque so rows cannot read through it", async ({ page }) => {
    await openWideList(page, NARROW, 60);

    const paint = await head(page, "Caption").evaluate((el) => {
      const css = getComputedStyle(el);
      return { background: css.backgroundColor, shadow: css.boxShadow };
    });
    expect(paint.background).not.toBe("rgba(0, 0, 0, 0)");
    // `border-collapse: collapse` gives the border to the table, so it would
    // stay behind when the head sticks. The cell paints its own line.
    expect(paint.shadow).not.toBe("none");
  });

  test("carries the head sideways with its own columns", async ({ page }) => {
    await openWideList(page);

    // One table, so the head cannot drift out of line with the body — but it
    // is the alignment that makes a locked head worth having, so assert it.
    const columnBefore = (await head(page, "Stage").boundingBox())!.x;
    const cellBefore = (
      await page.getByText(WIDE_STAGE, { exact: true }).boundingBox()
    )!.x;
    expect(columnBefore).toBeCloseTo(cellBefore, 0);

    await page.locator(view).evaluate((el: Element) => {
      el.scrollLeft = 200;
    });

    const columnAfter = (await head(page, "Stage").boundingBox())!.x;
    const cellAfter = (
      await page.getByText(WIDE_STAGE, { exact: true }).boundingBox()
    )!.x;
    expect(columnAfter).toBeCloseTo(cellAfter, 0);
    expect(columnAfter).toBeCloseTo(columnBefore - 200, 0);
  });

  test("still sorts from the head after scrolling down", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/matters");
    await expect(page.locator("table.data")).toBeVisible();

    await page.locator(view).evaluate((el: Element) => {
      el.scrollTop = el.scrollHeight;
    });
    await head(page, "Practice Area").click();

    // A head you can see but not use would be worse than no head at all.
    await expect(page.locator("table.data thead")).toContainText("Practice Area");
    await expect(
      page.locator("th").filter({ hasText: "Practice Area" }).locator("svg")
    ).toBeVisible();
  });

  test("locks the head on every module, not just matters", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 620 });

    for (const [path, column] of [
      ["/timekeepers", "Role"],
      ["/invoices", "Balance Due"],
      ["/time_entries", "Hours"],
    ] as const) {
      await page.goto(path);
      await expect(page.locator("table.data")).toBeVisible();
      const position = await head(page, column).evaluate(
        (el) => getComputedStyle(el).position
      );
      expect(position, `${path} head should be sticky`).toBe("sticky");
    }
  });

  test("gives the table the window's leftover height instead of scrolling the page", async ({
    page,
  }) => {
    await openWideList(page, NARROW, 60);

    // The mechanism behind the lock: a `<thead>` sticks to its nearest
    // scrollport, so the table has to be the thing that scrolls.
    const pageScrolls = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight
    );
    expect(pageScrolls).toBeLessThanOrEqual(1);
    expect(
      await page.locator(view).evaluate((el: Element) => el.scrollHeight > el.clientHeight)
    ).toBe(true);

    // The search box is a fixture of the screen now, not something to scroll
    // back up for.
    await expect(page.getByPlaceholder("Search matters…")).toBeInViewport();
  });
});
