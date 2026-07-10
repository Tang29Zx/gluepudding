import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const tarotMeaningSchema = z.object({
  keywords: z.array(z.string()),
  meaning: z.string(),
}).strict();

const tarotCardSchema = z.object({
  id: z.number().int().min(0).max(21),
  name: z.string(),
  nameEn: z.string(),
  keywords: z.array(z.string()),
  reversed: tarotMeaningSchema,
  upright: tarotMeaningSchema,
}).strict();

const hexagramSchema = z.object({
  code: z.string(),
  description: z.string(),
  name: z.string(),
  number: z.number().int().min(1).max(64),
  symbol: z.string(),
}).strict();

export type TarotCardData = z.infer<typeof tarotCardSchema>;
export type HexagramData = z.infer<typeof hexagramSchema>;

function readDataFile(fileName: string): unknown {
  const bundledUrl = new URL(`./data/${fileName}`, import.meta.url);
  const sourceUrl = new URL(
    `../../nav-world/src/modules/divination/data/${fileName}`,
    import.meta.url,
  );
  const url = existsSync(bundledUrl) ? bundledUrl : sourceUrl;
  return JSON.parse(readFileSync(url, "utf8")) as unknown;
}

export interface FortuneData {
  hexagramsByNumber: ReadonlyMap<number, HexagramData>;
  tarotCardsById: ReadonlyMap<number, TarotCardData>;
}

export function loadFortuneData(): FortuneData {
  const tarotCards = z.array(tarotCardSchema).length(22).parse(
    readDataFile("tarot_cards.json"),
  );
  const hexagrams = z.array(hexagramSchema).length(64).parse(
    readDataFile("iching_64.json"),
  );

  return {
    hexagramsByNumber: new Map(
      hexagrams.map((hexagram) => [hexagram.number, hexagram]),
    ),
    tarotCardsById: new Map(tarotCards.map((card) => [card.id, card])),
  };
}
