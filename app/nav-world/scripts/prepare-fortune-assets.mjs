import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const projectRoot = resolve(navWorldDir, "../..");
const sourceDir = resolve(projectRoot, "resources/fortune");
const outputDir = resolve(navWorldDir, "public/models/fortune");
const shouldCheckOnly = process.argv.includes("--check");

const fortuneAssets = [
  ["tarot_tent.glb", "tarot_tent.glb"],
  ["tarot_table.glb", "tarot_table.glb"],
  ["tarot_table_cloth.glb", "tarot_table_cloth.glb"],
  ["tarot_magic_circle.glb", "tarot_magic_circle.glb"],
  ["tarot_candle_stand.glb", "tarot_candle_stand.glb"],
  ["tarot_crystal_ball.glb", "tarot_crystal_ball.glb"],
  ["tarot_crystal_base.glb", "tarot_crystal_base.glb"],
  ["tarot_card.glb", "tarot_card.glb"],
  ["zodiac_altar_base.glb", "zodiac_altar_base.glb"],
  ["zodiac_star_dome.glb", "zodiac_star_dome.glb"],
  ["zodiac_wheel.glb", "zodiac_wheel.glb"],
  ["zodiac_result_stand.glb", "zodiac_result_stand.glb"],
  ["iching_table(1).glb", "iching_table.glb"],
  ["iching_coin_2(1).glb", "iching_coin.glb"],
  ["iching_hexagram_board.glb", "iching_hexagram_board.glb"],
  ["iching_line_yang.glb", "iching_line_yang.glb"],
  ["iching_bamboo_slips.glb", "iching_bamboo_slips.glb"],
  ["iching_lot_cylinder.glb", "iching_lot_cylinder.glb"],
];

const expectedOutputs = new Set(fortuneAssets.map(([, outputName]) => outputName));

function listFilesRecursively(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(entryPath));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

function validateOutput() {
  const errors = [];

  if (!existsSync(outputDir)) {
    errors.push(`Missing output directory: ${outputDir}`);
    return errors;
  }

  for (const [, outputName] of fortuneAssets) {
    const outputPath = join(outputDir, outputName);

    if (!existsSync(outputPath)) {
      errors.push(`Missing fortune asset: ${outputName}`);
    }
  }

  for (const outputPath of listFilesRecursively(outputDir)) {
    const outputName = basename(outputPath);
    const relativePath = outputPath.slice(outputDir.length + 1);

    if (relativePath.includes("textures/")) {
      errors.push(`Unexpected texture directory asset: ${relativePath}`);
    }

    if (!expectedOutputs.has(outputName)) {
      errors.push(`Unexpected fortune asset: ${relativePath}`);
    }
  }

  return errors;
}

if (shouldCheckOnly) {
  const errors = validateOutput();

  if (errors.length > 0) {
    console.error("Fortune asset check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Fortune asset check passed.");
  process.exit(0);
}

if (!existsSync(sourceDir)) {
  console.error(
    `Missing ${sourceDir}. Make sure resources/fortune.zip has been extracted.`,
  );
  process.exit(1);
}

rmSync(outputDir, { force: true, recursive: true });
mkdirSync(outputDir, { recursive: true });

let totalBytes = 0;

for (const [sourceName, outputName] of fortuneAssets) {
  const sourcePath = resolve(sourceDir, sourceName);
  const outputPath = resolve(outputDir, outputName);

  if (!existsSync(sourcePath)) {
    console.error(`Missing source fortune asset: ${sourcePath}`);
    process.exit(1);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  copyFileSync(sourcePath, outputPath);
  totalBytes += statSync(outputPath).size;
}

console.log(
  `Prepared ${fortuneAssets.length} fortune assets in ${outputDir} (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`,
);
