import { execFileSync } from "node:child_process";
import { existsSync, renameSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const audioFiles = [
  "public/audio/loading_bgm.mp3",
  "public/audio/world_bgm.mp3",
  "public/audio/fortune_bgm.mp3",
];
const targetBitrate = 128_000;
const reencodeThreshold = 160_000;

function readBitrate(filePath) {
  return Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=bit_rate",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
}

for (const relativePath of audioFiles) {
  const filePath = resolve(navWorldDir, relativePath);

  if (!existsSync(filePath)) {
    throw new Error(`Missing audio asset: ${filePath}`);
  }

  const beforeBytes = statSync(filePath).size;
  const beforeBitrate = readBitrate(filePath);

  if (beforeBitrate <= reencodeThreshold) {
    console.log(
      JSON.stringify({
        bitrate: beforeBitrate,
        bytes: beforeBytes,
        file: relativePath,
        skipped: true,
      }),
    );
    continue;
  }

  const tempPath = `${filePath}.tmp.mp3`;

  try {
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        filePath,
        "-map_metadata",
        "0",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        tempPath,
      ],
      { stdio: "inherit" },
    );

    const afterBytes = statSync(tempPath).size;

    if (afterBytes >= beforeBytes) {
      throw new Error(`Optimized audio is not smaller: ${relativePath}`);
    }

    renameSync(tempPath, filePath);
    console.log(
      JSON.stringify({
        afterBitrate: readBitrate(filePath),
        afterBytes,
        beforeBitrate,
        beforeBytes,
        file: relativePath,
      }),
    );
  } finally {
    rmSync(tempPath, { force: true });
  }
}

console.log(`Audio target bitrate: ${targetBitrate} bps.`);
