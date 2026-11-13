// Records the footage for the demo films: the real React app, driven by
// Playwright, against the E2E suite's mocked /api loaded with the shipped
// practice dataset (see ../scripts/build_data.py).
//
// Run from the frontend folder so @playwright/test resolves from there:
//   cd ../../../frontend
//   npx playwright test --config ../Demo/studio/capture/playwright.config.mjs
//
// Plain object, no import: this file lives outside the frontend package.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "../../../frontend");

export default {
  testDir: here,
  testMatch: /.*\.capture\.ts/,
  outputDir: path.join(here, ".results"),
  fullyParallel: true,
  workers: 4,
  timeout: 240_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  },
  webServer: {
    command: "npm run dev",
    cwd: frontend,
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 120_000,
  },
};
