import assert from "node:assert/strict";
import test from "node:test";
import {
  ichingAiRequestSchema,
  tarotAiRequestSchema,
} from "../src/contracts.js";

test("tarot schema accepts the reduced trusted-data contract", () => {
  const result = tarotAiRequestSchema.safeParse({
    cards: [
      { index: 0, isUpright: true, position: "past" },
      { index: 1, isUpright: false, position: "present" },
      { index: 2, isUpright: true, position: "future" },
    ],
    deck: "major",
    question: "接下来应该注意什么？",
    spread: "three_card",
  });

  assert.equal(result.success, true);
});

test("schemas reject extra and oversized input", () => {
  assert.equal(tarotAiRequestSchema.safeParse({
    cards: [{ index: 0, isUpright: true, position: "single" }],
    deck: "major",
    injectedMeaning: "untrusted",
    question: "test",
    spread: "single",
  }).success, false);

  assert.equal(ichingAiRequestSchema.safeParse({
    changedNumber: null,
    changingLines: [],
    originalNumber: 1,
    question: "问".repeat(97),
  }).success, false);
});

test("iching schema enforces changed-number consistency", () => {
  assert.equal(ichingAiRequestSchema.safeParse({
    changedNumber: 2,
    changingLines: [],
    originalNumber: 1,
    question: "test",
  }).success, false);
});
