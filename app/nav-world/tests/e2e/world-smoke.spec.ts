import {
  devices,
  expect,
  type BrowserContext,
  type Page,
  test,
} from "@playwright/test";

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
    /\/audio\/[^/]+\.mp3(?:[?#].*)?$/.test(url)
  );
}

function isIgnorableConsoleError(text: string): boolean {
  return text.includes(
    "Failed to load resource: the server responded with a status of 401",
  );
}

function isExpectedAuthProbeResponse(url: string, status: number): boolean {
  return status === 401 && /\/api\/auth\/session(?:[?#].*)?$/.test(url);
}

function collectPageFailures(page: Page): string[] {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !isIgnorableConsoleError(message.text())
    ) {
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
    if (isExpectedAuthProbeResponse(response.url(), response.status())) {
      return;
    }

    if (response.status() >= 400) {
      failures.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  return failures;
}

test("loads the perspective shadow game iframe page", async ({ page }) => {
  const failures = collectPageFailures(page);
  const loadedGameModels = new Set<string>();
  const readyMessage = page.waitForEvent("console", (message) =>
    message.text().includes("视角塑影师 ready"),
  );

  page.on("response", (response) => {
    const url = response.url();
    const modelName = url.match(/\/models\/game\/([^/?#]+\.glb)(?:[?#].*)?$/)?.[1];

    if (modelName && response.status() === 200) {
      loadedGameModels.add(modelName);
    }
  });

  await page.goto("/game/shadow-game.html");
  await readyMessage;

  const canvas = page.locator("#c");
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element) => ({
        height: element.clientHeight,
        width: element.clientWidth,
      })),
    )
    .toMatchObject({
      height: expect.any(Number),
      width: expect.any(Number),
    });

  const canvasSize = await canvas.evaluate((element) => ({
    height: element.clientHeight,
    width: element.clientWidth,
  }));

  expect(canvasSize.width).toBeGreaterThan(300);
  expect(canvasSize.height).toBeGreaterThan(150);

  await expect
    .poll(() =>
      [
        "environment_ground.glb",
        "environment_screen.glb",
        "environment_pillar.glb",
      ].every((modelName) => loadedGameModels.has(modelName)),
    )
    .toBe(true);

  expect(failures).toEqual([]);
});

test("protects fortune AI routes without exposing provider details", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  const healthResponse = await request.get("/api/fortune/health");
  expect(healthResponse.status()).toBe(200);
  const healthText = await healthResponse.text();
  expect(healthText).not.toContain("deepseek");

  for (const path of [
    "/api/fortune/tarot/ai",
    "/api/fortune/admin/tarot/ai",
  ]) {
    const response = await request.post(path, {
      data: {
        cards: [{ index: 0, isUpright: true, position: "single" }],
        deck: "major",
        question: "test",
        spread: "single",
      },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "AUTH_REQUIRED",
      success: false,
    });
  }
});

test.describe.serial("loaded 3D world", () => {
  let context: BrowserContext;
  let failures: string[];
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(12 * 60 * 1000);
    const isMobile = testInfo.project.name === "chromium-mobile";
    context = await browser.newContext({
      ...(isMobile ? devices["Pixel 7"] : devices["Desktop Chrome"]),
      viewport: isMobile
        ? { width: 390, height: 844 }
        : { width: 1365, height: 768 },
    });
    page = await context.newPage();
    failures = collectPageFailures(page);
    await page.goto("/");
    await expect(page.locator(".startup-screen")).toHaveCount(0, {
      timeout: 12 * 60 * 1000,
    });
    await expect(page.locator(".fallback-page")).toHaveCount(0);
    await expect(page.locator(".world-canvas canvas")).toBeVisible();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("loads the 3D world canvas", async () => {
    const canvas = page.locator(".world-canvas canvas");
    const canvasSize = await canvas.evaluate((element) => ({
      height: element.clientHeight,
      width: element.clientWidth,
    }));

    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
    await expect(page.locator(".world-status")).toBeVisible();
    expect(failures).toEqual([]);
  });

  test("places and retracts the world gomoku board with hotkeys", async () => {
    await page.keyboard.press("KeyG");
    await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已展开");

    await page.keyboard.press("KeyG");
    await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已移动");

    await page.keyboard.press("KeyH");
    await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已收回");

    expect(failures).toEqual([]);
  });

  test("plays a native world gomoku turn against AI", async () => {

  await page.keyboard.press("KeyG");
  await expect(page.locator(".world-interaction-bar")).toContainText("棋盘已展开");

  await expect
    .poll(() =>
      page.evaluate(() => Boolean(window.__gomokuQa?.getState().isOpen)),
    )
    .toBe(true);

  expect(await page.evaluate(() => window.__gomokuQa?.getState().difficulty))
    .toBe("legend");

  for (let index = 0; index < 3; index += 1) {
    await page.evaluate(() => window.__gomokuQa?.activateControl("difficulty"));
  }
  expect(await page.evaluate(() => window.__gomokuQa?.getState().difficulty))
    .toBe("fast");

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
});

test("shows the 2D fallback when forced", async ({ page }) => {
  const failures = collectPageFailures(page);

  await page.goto("/?forceFallback");
  await expect(page.locator(".fallback-page")).toBeVisible();
  await expect(page.locator(".world-canvas canvas")).toHaveCount(0);
  expect(failures).toEqual([]);
});
