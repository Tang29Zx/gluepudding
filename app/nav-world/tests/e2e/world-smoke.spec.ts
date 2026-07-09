import { expect, type Page, test } from "@playwright/test";

type GomokuQaState = {
  difficulty: string;
  history: readonly {
    color: number;
    x: number;
    y: number;
  }[];
  isOpen: boolean;
  status: string;
  winner: number | null;
};

function isIgnorableRequestFailure(url: string, errorText: string): boolean {
  return (
    errorText.includes("net::ERR_ABORTED") &&
    /\/audio\/[^/]+\.mp3$/.test(url)
  );
}

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
    const errorText = request.failure()?.errorText ?? "";

    if (isIgnorableRequestFailure(request.url(), errorText)) {
      return;
    }

    failures.push(
      `Request failed: ${request.url()} ${errorText}`,
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

test("places and retracts the world gomoku board with hotkeys", async ({ page }) => {
  const failures = collectPageFailures(page);

  await page.goto("/");
  await expect(page.locator(".startup-screen")).toHaveCount(0);
  await expect(page.locator(".world-canvas canvas")).toBeVisible();

  await page.keyboard.press("KeyG");
  await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已展开");

  await page.keyboard.press("KeyG");
  await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已移动");

  await page.keyboard.press("KeyH");
  await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已收回");

  expect(failures).toEqual([]);
});

test("plays a native world gomoku turn against AI", async ({ page }) => {
  const failures = collectPageFailures(page);

  await page.goto("/");
  await expect(page.locator(".startup-screen")).toHaveCount(0);
  await expect(page.locator(".world-canvas canvas")).toBeVisible();

  await page.keyboard.press("KeyG");
  await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已展开");

  await expect
    .poll(() =>
      page.evaluate(() => Boolean(window.__gomokuQa?.getState().isOpen)),
    )
    .toBe(true);

  expect(await page.evaluate(() => window.__gomokuQa?.getState().difficulty))
    .toBe("legend");

  const didMove = await page.evaluate(() => window.__gomokuQa?.playMove(12, 12));
  expect(didMove).toBe(true);

  await expect
    .poll(() =>
      page.evaluate(() => window.__gomokuQa?.getState() as GomokuQaState | undefined),
    )
    .toMatchObject({
      history: [
        { color: 1, x: 12, y: 12 },
        { color: 2 },
      ],
      status: "player",
      winner: null,
    });

  const undoMessage = await page.evaluate(() =>
    window.__gomokuQa?.activateControl("undo"),
  );
  expect(undoMessage).toContain("已悔棋");
  await expect
    .poll(() =>
      page.evaluate(() => window.__gomokuQa?.getState().history.length),
    )
    .toBe(0);

  await page.evaluate(() => window.__gomokuQa?.playMove(12, 12));
  await expect
    .poll(() =>
      page.evaluate(() => window.__gomokuQa?.getState().history.length),
    )
    .toBeGreaterThanOrEqual(2);

  const restartMessage = await page.evaluate(() =>
    window.__gomokuQa?.activateControl("restart"),
  );
  expect(restartMessage).toContain("新棋局");
  await expect
    .poll(() =>
      page.evaluate(() => window.__gomokuQa?.getState().history.length),
    )
    .toBe(0);

  await page.evaluate(() => window.__gomokuQa?.playMove(12, 12));
  await expect
    .poll(() =>
      page.evaluate(() => window.__gomokuQa?.getState().history.length),
    )
    .toBeGreaterThanOrEqual(2);

  await page.keyboard.press("KeyH");
  await expect
    .poll(() =>
      page.evaluate(() => window.__gomokuQa?.getState().isOpen),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(() => window.__gomokuQa?.getState().history.length),
    )
    .toBeGreaterThanOrEqual(2);

  expect(failures).toEqual([]);
});

test("shows the 2D fallback when forced", async ({ page }) => {
  const failures = collectPageFailures(page);

  await page.goto("/?forceFallback");
  await expect(page.locator(".fallback-page")).toBeVisible();
  await expect(page.locator(".world-canvas canvas")).toHaveCount(0);
  expect(failures).toEqual([]);
});
