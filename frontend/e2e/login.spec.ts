import type { Page } from "@playwright/test";

import { expect, signedOut, test } from "./fixtures";

test.use(signedOut);

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders the brand story and the sign-in card", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Legal practice, modernised." })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    // The sign-in is the last spread of a guide to the firm, open on the desk.
    const guide = page.getByRole("region", { name: "A guide to InventDB Legal" });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole("heading", { name: "New to InventDB Legal?" })).toBeVisible();
    await expect(page.getByText("Powered by InventDB SOAR — secure & real-time")).toBeVisible();
  });

  test("signs in and lands on the dashboard", async ({ page }) => {
    await page.getByLabel("Username", { exact: true }).fill("e2e.manager");
    await page.getByLabel("Password", { exact: true }).fill("correct-horse");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("legal.token"))).toBe("e2e-test-token");
  });

  test("trims whitespace off the username before sending it", async ({ page }) => {
    await page.getByLabel("Username", { exact: true }).fill("   e2e.manager   ");
    await page.getByLabel("Password", { exact: true }).fill("correct-horse");

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/auth/login") && r.method() === "POST"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);

    expect(request.postDataJSON()).toEqual({
      username: "e2e.manager",
      password: "correct-horse",
    });
  });

  test("surfaces the server's error message on bad credentials", async ({ page }) => {
    await page.getByLabel("Username", { exact: true }).fill("e2e.manager");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator(".alert.error")).toHaveText("Invalid username or password");
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem("legal.token"))).toBeNull();
  });

  test("keeps the user on the page when a field is empty", async ({ page }) => {
    // Both inputs are `required`, so the browser blocks submission before any
    // request goes out.
    let requested = false;
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/login")) requested = true;
    });

    await page.getByLabel("Username", { exact: true }).fill("e2e.manager");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login/);
    expect(requested).toBe(false);
  });

  test("toggles password visibility", async ({ page }) => {
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("points registration at InventDB in a new tab", async ({ page }) => {
    const link = page.getByRole("link", { name: /Register on InventDB/ });
    await expect(link).toHaveAttribute("href", "https://www.inventdb.com");
    await expect(link).toHaveAttribute("target", "_blank");
    // Without noopener the opened tab can reach back through window.opener.
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("shows a spinner state while the request is in flight", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, token: "e2e-test-token", user: { username: "e2e.manager" } }),
      });
    });

    await page.getByLabel("Username", { exact: true }).fill("e2e.manager");
    await page.getByLabel("Password", { exact: true }).fill("correct-horse");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("button", { name: /Signing in/ })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  });

  test("reports a network failure instead of hanging", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => route.abort("failed"));

    await page.getByLabel("Username", { exact: true }).fill("e2e.manager");
    await page.getByLabel("Password", { exact: true }).fill("correct-horse");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.locator(".alert.error")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});

test.describe("The guide on the desk", () => {
  const guide = (page: Page) => page.getByRole("region", { name: "A guide to InventDB Legal" });
  const where = (page: Page) => page.locator(".dk-where-now");

  test("with reduced motion, opens straight at sign in, and turns back through the chapters", async ({ page }) => {
    await page.goto("/login");
    await expect(where(page)).toHaveText("Sign in");
    await expect(page.getByRole("button", { name: "Skip to sign in" })).toHaveCount(0);

    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(where(page)).toContainText("Compliance");
    await expect(guide(page).getByRole("heading", { name: "Client money, by the book" })).toBeVisible();
    // Pages that are not open are out of reach: the sign-in form is behind the page now.
    await expect(guide(page).getByRole("heading", { name: "Welcome back" })).toHaveCount(0);

    await page.keyboard.press("ArrowLeft");
    await expect(where(page)).toContainText("Profitability");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(where(page)).toHaveText("Sign in");
    await expect(guide(page).getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("the contents jump to a chapter", async ({ page }) => {
    await page.goto("/login");
    for (let i = 0; i < 7; i++) await page.getByRole("button", { name: "Previous page" }).click();
    await expect(where(page)).toHaveText("Foreword");
    await guide(page).getByRole("button", { name: /Risk & Deadlines/ }).click();
    await expect(guide(page).getByRole("heading", { name: "No deadline missed" })).toBeVisible();
  });

  test("every visit opens with the firm's mark, and Skip goes straight to sign in", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "no-preference",
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto("/login");
    const walkIn = page.locator(".dk-intro");
    await expect(walkIn).toBeVisible();
    // The booklet waits behind it, out of reach.
    await expect(page.locator(".dk-shell")).toHaveAttribute("inert", "");
    await walkIn.getByRole("button", { name: "Skip to sign in" }).click();
    await expect(walkIn).toHaveCount(0);
    await expect(where(page)).toHaveText("Sign in");
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    // It is short, so it plays again on the next visit.
    await page.reload();
    await expect(walkIn).toBeVisible();
    await context.close();
  });

  test("after the opening, the booklet opens on its own, and can be skipped to sign in", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "no-preference",
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto("/login");
    // The opening hands the booklet over closed; it then opens by itself.
    await expect(page.locator(".dk-intro")).toHaveCount(0, { timeout: 15000 });
    await expect(where(page)).toHaveText("Foreword", { timeout: 6000 });
    await page.getByRole("button", { name: "Pause the tour" }).click();
    await expect(page.getByRole("button", { name: "Play the tour" })).toBeVisible();

    await page.getByRole("button", { name: "Skip to sign in" }).click();
    await expect(where(page)).toHaveText("Sign in");
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    // Having seen it, the next visit goes straight to sign in.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("legal.desk.seen"))).toBe("1");
    await context.close();
  });
});

test.describe("Route protection", () => {
  for (const path of ["/", "/matters", "/reports", "/workflows", "/settings"]) {
    test(`redirects ${path} to the login page when signed out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    });
  }
});
