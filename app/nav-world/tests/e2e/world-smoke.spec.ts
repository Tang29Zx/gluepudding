import { expect, type Page, test } from "@playwright/test";

function collectPageFailures(page: Page): string[] {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`Console error: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    failures.push(`Page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    failures.push(
      `Request failed: ${request.url()} ${request.failure()?.errorText ?? ""}`,
    );
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  return failures;
}

test("loads the 3D world canvas", async ({ page }) => {
  const failures = collectPageFailures(page);

  await page.goto("/");
  await expect(page.locator(".startup-screen")).toHaveCount(0);
  await expect(page.locator(".fallback-page")).toHaveCount(0);

  const canvas = page.locator(".world-canvas canvas");
  await expect(canvas).toBeVisible();

  const canvasSize = await canvas.evaluate((element) => ({
    height: element.clientHeight,
    width: element.clientWidth,
  }));

  expect(canvasSize.width).toBeGreaterThan(0);
  expect(canvasSize.height).toBeGreaterThan(0);
  await expect(page.locator(".world-status")).toBeVisible();
  expect(failures).toEqual([]);
});

test("shows the 2D fallback when forced", async ({ page }) => {
  const failures = collectPageFailures(page);

  await page.goto("/?forceFallback");
  await expect(page.locator(".fallback-page")).toBeVisible();
  await expect(page.locator(".world-canvas canvas")).toHaveCount(0);
  expect(failures).toEqual([]);
});
