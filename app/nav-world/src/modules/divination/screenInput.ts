export type FortuneQuestionControl = "cancel" | "confirm" | "input";

export const fortuneQuestionMaxLength = 96;

export function normalizeQuestionText(
  value: string,
  maxLength = fortuneQuestionMaxLength,
): string {
  return value.replace(/\s+/g, " ").slice(0, maxLength);
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxChars: number,
  lineHeight: number,
  maxLines = 4,
): void {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  let line = 0;
  for (let i = 0; i < trimmed.length && line < maxLines; i += maxChars) {
    const suffix = i + maxChars < trimmed.length && line === maxLines - 1
      ? "..."
      : "";
    ctx.fillText(
      `${trimmed.slice(i, i + maxChars)}${suffix}`,
      x,
      y + line * lineHeight,
    );
    line += 1;
  }
}
