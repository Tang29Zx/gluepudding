import { staticAssetUrl } from "./staticAssetUrl";
import {
  criticalWorldAssets,
  type WorldAssetManifestItem,
} from "./worldAssetManifest";

export interface StartupAssetProgress {
  bytesLoaded: number;
  bytesPerSecond: number;
  bytesTotal: number;
  completed: number;
  currentLabel: string;
  failedAttempts: number;
  total: number;
}

interface AssetGroupPreloadOptions {
  concurrency?: number;
  priority?: "high" | "low";
}

const maxAttempts = 3;
const maxConcurrency = 4;
const retryBaseDelayMs = 1_200;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timeoutId = window.setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function readAssetSize(
  asset: WorldAssetManifestItem,
  signal: AbortSignal,
): Promise<number> {
  try {
    const response = await fetch(staticAssetUrl(asset.path), {
      cache: "force-cache",
      credentials: "same-origin",
      method: "HEAD",
      signal,
    });

    if (!response.ok) {
      return 0;
    }

    return Number(response.headers.get("content-length")) || 0;
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    return 0;
  }
}

async function preloadOneAsset(
  asset: WorldAssetManifestItem,
  signal: AbortSignal,
  onChunk: (loadedBytes: number, totalBytes: number) => void,
  priority?: "high" | "low",
): Promise<void> {
  const requestInit: RequestInit & { priority?: "high" | "low" } = {
    cache: "force-cache",
    credentials: "same-origin",
    signal,
  };

  if (priority) {
    requestInit.priority = priority;
  }

  const response = await fetch(staticAssetUrl(asset.path), requestInit);

  if (!response.ok) {
    throw new Error(`${asset.path} returned ${response.status}`);
  }

  const responseTotal = Number(response.headers.get("content-length")) || 0;
  const reader = response.body?.getReader();

  if (!reader) {
    const buffer = await response.arrayBuffer();
    onChunk(buffer.byteLength, responseTotal || buffer.byteLength);
    return;
  }

  let loadedBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      onChunk(loadedBytes, responseTotal || loadedBytes);
      return;
    }

    loadedBytes += result.value.byteLength;
    onChunk(loadedBytes, responseTotal);
  }
}

export async function preloadAssetGroup(
  assets: readonly WorldAssetManifestItem[],
  onProgress: (progress: StartupAssetProgress) => void,
  signal: AbortSignal,
  options: AssetGroupPreloadOptions = {},
): Promise<void> {
  const loadedByPath = new Map<string, number>();
  const totalByPath = new Map<string, number>();
  let completed = 0;
  let failedAttempts = 0;
  let nextAssetIndex = 0;
  let currentLabel = assets[0]?.label ?? "关键世界资源";
  const startedAt = performance.now();

  const emitProgress = () => {
    const bytesLoaded = [...loadedByPath.values()].reduce(
      (sum, value) => sum + value,
      0,
    );
    const elapsedSeconds = Math.max(
      0.001,
      (performance.now() - startedAt) / 1000,
    );

    onProgress({
      bytesLoaded,
      bytesPerSecond: bytesLoaded / elapsedSeconds,
      bytesTotal: [...totalByPath.values()].reduce(
        (sum, value) => sum + value,
        0,
      ),
      completed,
      currentLabel,
      failedAttempts,
      total: assets.length,
    });
  };

  const sizes = await Promise.all(
    assets.map((asset) => readAssetSize(asset, signal)),
  );
  sizes.forEach((size, index) => {
    totalByPath.set(assets[index].path, size);
    loadedByPath.set(assets[index].path, 0);
  });
  emitProgress();

  const worker = async () => {
    while (nextAssetIndex < assets.length) {
      const assetIndex = nextAssetIndex;
      nextAssetIndex += 1;
      const asset = assets[assetIndex];
      currentLabel = asset.label;
      emitProgress();

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        loadedByPath.set(asset.path, 0);

        try {
          await preloadOneAsset(
            asset,
            signal,
            (loadedBytes, totalBytes) => {
              currentLabel = asset.label;
              loadedByPath.set(asset.path, loadedBytes);

              if (totalBytes > 0) {
                totalByPath.set(asset.path, totalBytes);
              }

              emitProgress();
            },
            options.priority,
          );
          completed += 1;
          emitProgress();
          break;
        } catch (error) {
          if (signal.aborted) {
            throw error;
          }

          failedAttempts += 1;
          emitProgress();

          if (attempt === maxAttempts) {
            throw error;
          }

          await wait(retryBaseDelayMs * attempt, signal);
        }
      }
    }
  };

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          options.concurrency ?? maxConcurrency,
          assets.length,
        ),
      },
      () => worker(),
    ),
  );
}

export async function preloadStartupAssets(
  onProgress: (progress: StartupAssetProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  return preloadAssetGroup(criticalWorldAssets, onProgress, signal);
}
