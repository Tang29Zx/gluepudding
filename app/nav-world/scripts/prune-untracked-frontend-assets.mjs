import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const gitRoot = resolve(navWorldDir, "../..");
const frontendDir = resolve(navWorldDir, "../frontend");
const frontendIndexPath = resolve(frontendDir, "index.html");
const frontendAssetsDir = resolve(frontendDir, "assets");
const frontendAssetsGitPath = "app/frontend/assets";
const shouldCheckOnly = process.argv.includes("--check");

function getReferencedAssetNames() {
  const html = readFileSync(frontendIndexPath, "utf8");
  const assetNames = new Set();
  const assetReferencePattern = /(?:href|src)=["']\.\/assets\/([^"']+)["']/g;

  for (const match of html.matchAll(assetReferencePattern)) {
    assetNames.add(match[1]);
  }

  return assetNames;
}

function getUntrackedAssetPaths() {
  const output = execFileSync(
    "git",
    ["status", "--porcelain", "--", frontendAssetsGitPath],
    {
      cwd: gitRoot,
      encoding: "utf8",
    },
  );

  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3));
}

function isGeneratedViteAsset(assetName) {
  return (
    /^WorldExperience-[\w-]+\.js$/.test(assetName) ||
    /^index-[\w-]+\.(js|css)$/.test(assetName)
  );
}

const referencedAssetNames = getReferencedAssetNames();
const pruneTargets = getUntrackedAssetPaths().filter((gitPath) => {
  const assetName = basename(gitPath);

  return (
    isGeneratedViteAsset(assetName) &&
    !referencedAssetNames.has(assetName)
  );
});

if (pruneTargets.length === 0) {
  console.log("No untracked, unreferenced frontend assets to prune.");
  process.exit(0);
}

if (shouldCheckOnly) {
  console.error("Untracked, unreferenced frontend assets were found:");
  for (const gitPath of pruneTargets) {
    console.error(`- ${gitPath}`);
  }
  process.exit(1);
}

for (const gitPath of pruneTargets) {
  const assetPath = resolve(frontendAssetsDir, basename(gitPath));
  rmSync(assetPath, { force: true });
  console.log(`Pruned ${gitPath}`);
}
