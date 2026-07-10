import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type {
  AuthUser,
  SessionAuthenticator,
} from "../src/authClient.js";
import { readConfig } from "../src/config.js";
import type { FortuneInterpreter } from "../src/fortuneAiService.js";
import { createFortuneAiHttpServer } from "../src/server.js";
import { UsageStore } from "../src/usageStore.js";

const validBody = {
  cards: [{ index: 0, isUpright: true, position: "single" }],
  deck: "major",
  question: "test",
  spread: "single",
};

async function withServer(
  user: AuthUser | null,
  run: (baseUrl: string, calls: { value: number }) => Promise<void>,
) {
  const calls = { value: 0 };
  const authenticator: SessionAuthenticator = {
    async authenticate() { return user; },
  };
  const interpreter: FortuneInterpreter = {
    getCacheSizes: () => ({ admin: 0, normal: 0 }),
    async interpret() {
      calls.value += 1;
      return { interpretation: "ok", source: "ai" };
    },
  };
  const usageStore = new UsageStore(":memory:");
  const server = createFortuneAiHttpServer({
    authClient: authenticator,
    config: readConfig({ FORTUNE_AI_ENABLED: "true" }),
    service: interpreter,
    usageStore,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;

  try {
    await run(`http://127.0.0.1:${port}`, calls);
  } finally {
    server.close();
    await once(server, "close");
    usageStore.close();
  }
}

test("unauthenticated requests never reach the interpreter", async () => {
  await withServer(null, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/api/fortune/tarot/ai`, {
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json() as { code: string }).code, "AUTH_REQUIRED");
    assert.equal(calls.value, 0);
  });
});

test("normal users cannot call the admin bypass route", async () => {
  await withServer({
    displayName: "User",
    id: "user",
    roles: [],
    username: "user",
  }, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/api/fortune/admin/tarot/ai`, {
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 403);
    assert.equal(calls.value, 0);
  });
});

test("admin route accepts a strict valid request", async () => {
  await withServer({
    displayName: "Admin",
    id: "admin",
    roles: ["admin"],
    username: "admin",
  }, async (baseUrl, calls) => {
    const response = await fetch(`${baseUrl}/api/fortune/admin/tarot/ai`, {
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(response.status, 200);
    assert.equal(calls.value, 1);
  });
});
