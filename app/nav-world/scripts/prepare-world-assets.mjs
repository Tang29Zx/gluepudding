import { execFileSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  openSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const projectRoot = resolve(navWorldDir, "../..");
const sourceZipPath = resolve(projectRoot, "resources/float-island-low-ploy.zip");
const outputPath = resolve(navWorldDir, "public/models/world/island.glb");
const tempOutputPath = `${outputPath}.tmp`;

mkdirSync(dirname(outputPath), { recursive: true });

let outputFd = null;

try {
  outputFd = openSync(tempOutputPath, "w");
  execFileSync("unzip", ["-p", sourceZipPath, "source/island.glb"], {
    cwd: projectRoot,
    stdio: ["ignore", outputFd, "inherit"],
  });
} catch (error) {
  try {
    unlinkSync(tempOutputPath);
  } catch {
    // Best effort cleanup for a partial extract.
  }

  console.error(
    `Failed to extract source/island.glb from ${sourceZipPath}. Make sure resources/float-island-low-ploy.zip exists.`,
  );
  throw error;
} finally {
  if (outputFd !== null) {
    closeSync(outputFd);
  }
}

renameSync(tempOutputPath, outputPath);

const { size } = statSync(outputPath);
console.log(`Prepared ${outputPath} (${(size / 1024 / 1024).toFixed(2)} MB).`);
