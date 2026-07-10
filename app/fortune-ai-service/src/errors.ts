import type { FortuneApiErrorCode } from "./contracts.js";

export class FortuneServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: FortuneApiErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "FortuneServiceError";
  }
}
