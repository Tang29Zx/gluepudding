import { execFileSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const projectRoot = resolve(navWorldDir, "../..");
const sourceZipPath = resolve(projectRoot, "resources/float-island-low-ploy.zip");
const outputDirectory = resolve(navWorldDir, "public/models/world");
const legacyOutputPath = resolve(outputDirectory, "island.glb");
const extractedOutputPath = resolve(outputDirectory, "island.source.tmp.glb");
const tempOutputDirectory = resolve(outputDirectory, ".prepared.tmp");
const builderPath = resolve(scriptDir, "build-world-streaming-assets.mjs");
const outputFileNames = [
  "ground.glb",
  "central-decor.glb",
  "sakura-tree-low.glb",
  "sakura-tree-mid.glb",
  "sakura-tree-high.glb",
];

mkdirSync(dirname(extractedOutputPath), { recursive: true });
rmSync(tempOutputDirectory, { force: true, recursive: true });
mkdirSync(tempOutputDirectory, { recursive: true });

let outputFd = null;

try {
  outputFd = openSync(extractedOutputPath, "w");
  execFileSync("unzip", ["-p", sourceZipPath, "source/island.glb"], {
    cwd: projectRoot,
    stdio: ["ignore", outputFd, "inherit"],
  });

  closeSync(outputFd);
  outputFd = null;

  execFileSync(
    process.execPath,
    [builderPath, extractedOutputPath, tempOutputDirectory],
    {
      cwd: projectRoot,
      stdio: "inherit",
    },
  );
} catch (error) {
  rmSync(tempOutputDirectory, { force: true, recursive: true });
  try {
    unlinkSync(extractedOutputPath);
  } catch {
    // Best effort cleanup for a partial extract.
  }

  console.error(
    `Failed to prepare source/island.glb from ${sourceZipPath}. Make sure the source archive and optimizer dependencies exist.`,
  );
  throw error;
} finally {
  if (outputFd !== null) {
    closeSync(outputFd);
  }
}

unlinkSync(extractedOutputPath);
for (const fileName of outputFileNames) {
  const tempPath = resolve(tempOutputDirectory, fileName);
  const outputPath = resolve(outputDirectory, fileName);
  renameSync(tempPath, outputPath);
  const { size } = statSync(outputPath);
  console.log(
    `Prepared ${outputPath} (${(size / 1024 / 1024).toFixed(2)} MB).`,
  );
}
rmSync(legacyOutputPath, { force: true });
rmSync(tempOutputDirectory, { force: true, recursive: true });
