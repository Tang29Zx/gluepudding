import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const gltfTransformPath = resolve(
  navWorldDir,
  "node_modules/.bin/gltf-transform",
);

const meshoptAssets = [
  "public/models/laboratory/dome.glb",
  "public/models/laboratory/glass_floor.glb",
  "public/models/laboratory/teleporter.glb",
  "public/models/fortune/tarot_tent.glb",
  "public/models/fortune/tarot_magic_circle.glb",
  "public/models/fortune/tarot_table.glb",
  "public/models/fortune/tarot_table_cloth.glb",
  "public/models/fortune/tarot_candle_stand.glb",
  "public/models/fortune/tarot_crystal_ball.glb",
  "public/models/fortune/tarot_crystal_base.glb",
  "public/models/fortune/tarot_card.glb",
  "public/models/fortune/tarot_card_sample_major_00_fool.glb",
  "public/models/fortune/zodiac_altar_base.glb",
  "public/models/fortune/zodiac_star_dome.glb",
  "public/models/fortune/zodiac_wheel.glb",
  "public/models/fortune/zodiac_result_stand.glb",
  "public/models/fortune/iching_table.glb",
  "public/models/fortune/iching_coin.glb",
  "public/models/fortune/iching_hexagram_board.glb",
  "public/models/fortune/iching_floor_pattern.glb",
  "public/models/fortune/iching_line_yang.glb",
  "public/models/fortune/iching_bamboo_slips.glb",
  "public/models/fortune/iching_lot_cylinder.glb",
];

const webpAssets = new Set([
  "public/models/laboratory/teleporter.glb",
  "public/models/fortune/iching_coin.glb",
  "public/models/fortune/iching_floor_pattern.glb",
  "public/models/fortune/zodiac_wheel.glb",
]);

function parseGlbJson(filePath) {
  const buffer = readFileSync(filePath);

  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`Invalid GLB: ${filePath}`);
  }

  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
}

function hasExtension(filePath, extensionName) {
  return parseGlbJson(filePath).extensionsUsed?.includes(extensionName) ?? false;
}

function runTransform(args) {
  execFileSync(gltfTransformPath, args, {
    cwd: navWorldDir,
    stdio: "inherit",
  });
}

function optimizeAsset(relativePath) {
  const filePath = resolve(navWorldDir, relativePath);

  if (!existsSync(filePath)) {
    throw new Error(`Missing streaming asset: ${filePath}`);
  }

  const originalBytes = statSync(filePath).size;
  const webpTempPath = `${filePath}.webp.tmp.glb`;
  const meshoptTempPath = `${filePath}.meshopt.tmp.glb`;
  let transformInputPath = filePath;

  try {
    if (
      webpAssets.has(relativePath) &&
      !hasExtension(filePath, "EXT_texture_webp")
    ) {
      runTransform([
        "webp",
        filePath,
        webpTempPath,
        "--near-lossless",
        "true",
        "--quality",
        "88",
        "--effort",
        "80",
      ]);
      transformInputPath = webpTempPath;
    }

    if (!hasExtension(transformInputPath, "EXT_meshopt_compression")) {
      runTransform([
        "optimize",
        transformInputPath,
        meshoptTempPath,
        "--compress",
        "meshopt",
        "--flatten",
        "false",
        "--join",
        "false",
        "--instance",
        "false",
        "--palette",
        "false",
        "--simplify",
        "false",
        "--texture-compress",
        "false",
      ]);
      transformInputPath = meshoptTempPath;
    }

    if (
      transformInputPath !== filePath &&
      statSync(transformInputPath).size < originalBytes
    ) {
      renameSync(transformInputPath, filePath);
    }
  } finally {
    rmSync(webpTempPath, { force: true });
    rmSync(meshoptTempPath, { force: true });
  }

  const optimizedBytes = statSync(filePath).size;
  console.log(
    JSON.stringify({
      afterBytes: optimizedBytes,
      beforeBytes: originalBytes,
      file: relativePath,
      reductionPercent: Number(
        ((1 - optimizedBytes / originalBytes) * 100).toFixed(1),
      ),
    }),
  );
}

for (const assetPath of meshoptAssets) {
  optimizeAsset(assetPath);
}
