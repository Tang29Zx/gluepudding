import assert from "node:assert/strict";
import test from "node:test";
import { UsageStore } from "../src/usageStore.js";

test("budget reservations are atomic and conservatively settled", () => {
  const store = new UsageStore(":memory:");
  try {
    assert.equal(store.reserveBudget("one", "2026-07-10", 60, 100), true);
    assert.equal(store.reserveBudget("two", "2026-07-10", 50, 100), false);
    store.settleReservation("one", null);
    const usage = store.getUsage("2026-07-10");
    assert.equal(usage.normal.actual_nano_usd, 60);
    assert.equal(usage.normal.reserved_nano_usd, 0);
    assert.equal(store.reserveBudget("three", "2026-07-10", 41, 100), false);
  } finally {
    store.close();
  }
});

test("daily user quota does not increment rejected requests", () => {
  const store = new UsageStore(":memory:");
  try {
    assert.equal(store.consumeUserDailyLimit("2026-07-10", "user", 2), true);
    assert.equal(store.consumeUserDailyLimit("2026-07-10", "user", 2), true);
    assert.equal(store.consumeUserDailyLimit("2026-07-10", "user", 2), false);
  } finally {
    store.close();
  }
});
