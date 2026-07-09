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

export function normalizeAiScreenText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[、.．]\s*/gm, "")
    .replace(/^\s*[一二三四五六七八九十]+[、.．]\s*/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapByPixelWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const chars = Array.from(text.trim());
  if (chars.length === 0) return [];

  const lines: string[] = [];
  let line = "";

  for (const char of chars) {
    const next = `${line}${char}`;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

export function drawFittedScreenText(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    maxHeight: number;
    lineHeight: number;
    overflowColor?: string;
    overflowText?: string;
    paragraphGap?: number;
  },
): boolean {
  const paragraphs = normalizeAiScreenText(text)
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const paragraphGap = options.paragraphGap ?? options.lineHeight * 0.35;
  const maxY = options.y + options.maxHeight;
  const reserve = options.overflowText ? options.lineHeight : 0;
  const textMaxY = maxY - reserve;
  let cursorY = options.y;
  let truncated = false;

  outer:
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    if (paragraphIndex > 0) cursorY += paragraphGap;

    for (const line of wrapByPixelWidth(ctx, paragraphs[paragraphIndex], options.maxWidth)) {
      if (cursorY > textMaxY) {
        truncated = true;
        break outer;
      }

      ctx.fillText(line, options.x, cursorY);
      cursorY += options.lineHeight;
    }
  }

  if (truncated && options.overflowText) {
    ctx.save();
    if (options.overflowColor) ctx.fillStyle = options.overflowColor;
    ctx.fillText(options.overflowText, options.x, maxY);
    ctx.restore();
  }

  return truncated;
}
