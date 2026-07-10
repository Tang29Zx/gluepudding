import { z } from "zod";

export type FortuneAiModule = "iching" | "tarot";
export type FortuneAccessClass = "admin" | "normal";

export type FortuneApiErrorCode =
  | "AI_UNAVAILABLE"
  | "AUTH_REQUIRED"
  | "BUSY"
  | "DAILY_BUDGET_EXHAUSTED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "RATE_LIMITED";

const questionSchema = z.string().trim().min(1).max(96);

const tarotCardSchema = z.object({
  index: z.number().int().min(0).max(21),
  isUpright: z.boolean(),
  position: z.enum(["single", "past", "present", "future"]),
}).strict();

export const tarotAiRequestSchema = z.object({
  cards: z.array(tarotCardSchema).min(1).max(3),
  deck: z.literal("major"),
  question: questionSchema,
  spread: z.enum(["single", "three_card"]),
}).strict().superRefine((value, context) => {
  const expectedLength = value.spread === "single" ? 1 : 3;
  if (value.cards.length !== expectedLength) {
    context.addIssue({
      code: "custom",
      message: `spread requires ${expectedLength} card(s)`,
      path: ["cards"],
    });
  }

  const indexes = new Set(value.cards.map((card) => card.index));
  if (indexes.size !== value.cards.length) {
    context.addIssue({
      code: "custom",
      message: "cards must be unique",
      path: ["cards"],
    });
  }

  const expectedPositions = value.spread === "single"
    ? ["single"]
    : ["past", "present", "future"];
  const positions = value.cards.map((card) => card.position).sort();
  if (positions.join("\0") !== [...expectedPositions].sort().join("\0")) {
    context.addIssue({
      code: "custom",
      message: "card positions do not match spread",
      path: ["cards"],
    });
  }
});

export const ichingAiRequestSchema = z.object({
  changedNumber: z.number().int().min(1).max(64).nullable(),
  changingLines: z.array(z.number().int().min(1).max(6)).max(6),
  originalNumber: z.number().int().min(1).max(64),
  question: questionSchema,
}).strict().superRefine((value, context) => {
  if (new Set(value.changingLines).size !== value.changingLines.length) {
    context.addIssue({
      code: "custom",
      message: "changing lines must be unique",
      path: ["changingLines"],
    });
  }

  if (value.changingLines.length === 0 && value.changedNumber !== null) {
    context.addIssue({
      code: "custom",
      message: "changedNumber must be null without changing lines",
      path: ["changedNumber"],
    });
  }
});

export type TarotAiRequest = z.infer<typeof tarotAiRequestSchema>;
export type IchingAiRequest = z.infer<typeof ichingAiRequestSchema>;
export type FortuneAiRequest = TarotAiRequest | IchingAiRequest;

export interface FortuneRoute {
  accessClass: FortuneAccessClass;
  module: FortuneAiModule;
}

const routeMap = new Map<string, FortuneRoute>([
  ["/api/fortune/tarot/ai", { accessClass: "normal", module: "tarot" }],
  ["/api/fortune/iching/ai", { accessClass: "normal", module: "iching" }],
  ["/api/fortune/admin/tarot/ai", { accessClass: "admin", module: "tarot" }],
  ["/api/fortune/admin/iching/ai", { accessClass: "admin", module: "iching" }],
]);

export function getFortuneRoute(pathname: string): FortuneRoute | null {
  return routeMap.get(pathname) ?? null;
}

export function parseFortuneRequest(
  module: FortuneAiModule,
  input: unknown,
): FortuneAiRequest {
  return module === "tarot"
    ? tarotAiRequestSchema.parse(input)
    : ichingAiRequestSchema.parse(input);
}
