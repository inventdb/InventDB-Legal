import {
  DESCRIBE_FENCED_STEPS,
  DESCRIBE_MATTER_STEPS,
  DESCRIBE_UNRESOLVED_STEPS,
  MODULES,
  dialog,
  expect,
  field,
  row,
  sseBody,
  test,
} from "./fixtures";

/**
 * "Describe it" — plain English into a New <type> form.
 *
 * The model is scripted here, which is the point: what these specs protect is
 * everything *around* the model. A description is only useful if what comes
 * back is translated honestly into the form — a lowercase choice snapped to a
 * real one, an owner named rather than keyed resolved against the records on
 * file, "$2,100" landing as a number — and if the parts that could not be
 * translated are said out loud instead of dropped.
 *
 * The other promise is a boundary: the assistant fills, the manager saves.
 * Nothing here writes a record on its own.
 */

/** Fulfil `/api/analyze/chat/stream` with a scripted turn. */
async function scriptFill(
  page: import("@playwright/test").Page,
  steps: Record<string, unknown>[]
) {
  await page.route(/\/api\/analyze\/chat\/stream/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody(steps),
    })
  );
}

async function describeIt(page: import("@playwright/test").Page, text: string) {
  await page.locator("#describe-record").fill(text);
  await page.getByRole("button", { name: "Fill the form" }).click();
}

test.describe("Describing a record", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/matters");
    await page.getByRole("button", { name: "New Matter" }).click();
    await expect(dialog(page)).toBeVisible();
  });

  test("fills the form, then leaves saving to the manager", async ({ page }) => {
    await scriptFill(page, DESCRIBE_MATTER_STEPS);
    await describeIt(
      page,
      "Rear-end collision on the 110 for Carmen Pineda, 4 March 2026. Bright Path " +
        "Childcare are the defendant, State Farm the carrier, claim 23-954458-D. " +
        "Pre-suit contingency, $2,100 held."
    );

    await expect(field(page, "matter_caption")).toHaveValue("Pineda v. Bright Path");
    await expect(field(page, "client_name")).toHaveValue("Pineda, Carmen");
    // A lowercase word snaps to the module's own choice list…
    await expect(field(page, "practice_area")).toHaveValue("Personal Injury");
    await expect(field(page, "status")).toHaveValue("Open");
    await expect(field(page, "court_short")).toHaveValue("LASC Stanley Mosk");
    // …a client named rather than keyed resolves against the clients on file…
    await expect(field(page, "client_id")).toHaveValue("CL-1123");
    // …money and separators survive the trip as plain numbers…
    await expect(field(page, "retainer_amount")).toHaveValue("2100");
    // …and a date written out in words becomes one the control accepts.
    await expect(field(page, "date_opened")).toHaveValue("2026-03-04");

    await expect(page.locator(".dsc-filled")).toContainText("Filled 15 fields");
    await expect(page.locator(".dsc-filled")).toContainText("Check them before saving");
    await expect(page.locator(".field.is-ai")).toHaveCount(15);

    // Nothing has been written yet — the record exists only once Save is pressed.
    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "POST" && r.url().endsWith("/api/matters")
      ),
      dialog(page).getByRole("button", { name: "Save" }).click(),
    ]);

    // `not_a_field` is in the scripted answer and absent here: a key the module
    // never declared is an invention, and inventing a column writes a record
    // nothing else in the practice can read.
    expect(request.postDataJSON()).toEqual({
      matter_caption: "Pineda v. Bright Path",
      client_id: "CL-1123",
      client_name: "Pineda, Carmen",
      practice_area: "Personal Injury",
      matter_type: "Motor Vehicle Accident",
      status: "Open",
      stage: "Pre-Litigation Demand",
      fee_model: "Contingency",
      court_short: "LASC Stanley Mosk",
      case_number: "24STCV03922",
      opposing_party: "Bright Path Childcare Centers, Inc.",
      insurance_carrier: "State Farm Mutual",
      claim_number: "23-954458-D",
      retainer_amount: 2100,
      date_opened: "2026-03-04",
    });

    await expect(page.locator(".toast.success")).toHaveText("Matter created");
    await expect(row(page, "Pineda v. Bright Path").first()).toBeVisible();
  });

  test("says what it could not place rather than dropping it", async ({ page }) => {
    await scriptFill(page, DESCRIBE_UNRESOLVED_STEPS);
    await describeIt(
      page,
      "Wexford v. Kestrel Holdings, under appeal, Wexford Partners are the clients."
    );

    await expect(field(page, "matter_caption")).toHaveValue("Wexford v. Kestrel Holdings");

    // A status that isn't a status and an owner nobody has on file are left for
    // a human — and named, so the manager knows the description was only
    // partly transcribed.
    const notes = page.locator(".dsc-unresolved");
    await expect(notes).toHaveCount(2);
    await expect(notes.filter({ hasText: "Under appeal" })).toContainText(
      "isn’t one of the Status choices"
    );
    await expect(notes.filter({ hasText: "Wexford Partners" })).toContainText(
      "No client on file matches"
    );
    await expect(field(page, "status")).toHaveValue("");
    await expect(field(page, "client_id")).toHaveValue("");
  });

  test("reads the answer even when it arrives wrapped in prose", async ({ page }) => {
    // The prompt asks for bare JSON; a model that adds a sentence and a code
    // fence has still done the work, and throwing it away would read as
    // flakiness for a reason nobody can see or fix.
    await scriptFill(page, DESCRIBE_FENCED_STEPS);
    await describeIt(page, "Ortega against Verdugo Hills.");

    await expect(field(page, "matter_caption")).toHaveValue("Ortega v. Verdugo Hills");
    await expect(field(page, "client_name")).toHaveValue("Ortega, Ruben");
  });

  test("keeps what was typed by hand", async ({ page }) => {
    await scriptFill(page, DESCRIBE_MATTER_STEPS);
    await field(page, "department").fill("Dept. 56");
    await describeIt(page, "Rear-end collision for Carmen Pineda.");

    await expect(field(page, "matter_caption")).toHaveValue("Pineda v. Bright Path");
    // The description never mentioned the department, so the fill has no
    // business clearing it.
    await expect(field(page, "department")).toHaveValue("Dept. 56");
  });

  test("a second description refines the form instead of restarting it", async ({
    page,
  }) => {
    await scriptFill(page, DESCRIBE_MATTER_STEPS);
    await describeIt(page, "Rear-end collision for Carmen Pineda.");
    await expect(field(page, "matter_caption")).toHaveValue("Pineda v. Bright Path");

    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "POST" && r.url().includes("/analyze/chat/stream")
      ),
      describeIt(page, "Actually it settled pre-suit."),
    ]);

    const prompt = String(request.postDataJSON().messages[0].content);
    expect(prompt).toContain("ALREADY ON THE FORM");
    expect(prompt).toContain("Pineda v. Bright Path");
    expect(prompt).toContain("Actually it settled pre-suit.");
    // A one-shot fill must not inherit whatever was last asked in Analyze.
    expect(request.postDataJSON().conversation_mode).toBe(false);
  });

  test("clears a field's mark once it has been looked at", async ({ page }) => {
    await scriptFill(page, DESCRIBE_MATTER_STEPS);
    await describeIt(page, "Rear-end collision for Carmen Pineda.");
    await expect(page.locator(".field.is-ai")).toHaveCount(15);

    await field(page, "client_name").fill("Pineda, Carmen R.");
    // Editing the value IS the review the mark was asking for.
    await expect(page.locator(".field.is-ai")).toHaveCount(14);
  });

  test("reports a model outage as an outage", async ({ page }) => {
    await scriptFill(page, [
      { type: "error", content: "Anthropic credits are exhausted." },
    ]);
    await describeIt(page, "Rear-end collision for Carmen Pineda.");

    await expect(page.locator(".dsc-error")).toContainText("temporarily unavailable");
    await expect(page.locator(".dsc-error")).toContainText("Your data is unaffected");
    await expect(field(page, "matter_caption")).toHaveValue("");
  });

  test("will not run on an empty description", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Fill the form" })).toBeDisabled();
    await page.locator("#describe-record").fill("A rear-end collision");
    await expect(page.getByRole("button", { name: "Fill the form" })).toBeEnabled();
  });
});

test.describe("Where it is offered", () => {
  // One test per module rather than one loop over all ten: every module gets
  // to fail by name, and none of them waits behind the other nine.
  for (const module of MODULES) {
    test(`a new ${module.label.toLowerCase()} can be described`, async ({ page }) => {
      await page.goto(`/${module.name}`);
      await page.getByRole("button", { name: `New ${module.label}` }).click();

      const composer = dialog(page).locator(".dsc");
      await expect(composer).toBeVisible();
      await expect(composer.getByRole("heading", { name: "Describe it" })).toBeVisible();

      // Each module carries its own example: a shared one would tell nobody how
      // much detail is worth typing about *this* kind of record.
      const placeholder = await page
        .locator("#describe-record")
        .getAttribute("placeholder");
      expect(placeholder?.length ?? 0).toBeGreaterThan(30);
    });
  }

  test("editing an existing record keeps the form it has always had", async ({
    page,
  }) => {
    await page.goto("/matters");
    await row(page, "Pineda v. Bright Path").getByRole("button", { name: "Edit" }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator(".dsc")).toHaveCount(0);
    await expect(field(page, "matter_caption")).toHaveValue("Pineda v. Bright Path");
  });
});
