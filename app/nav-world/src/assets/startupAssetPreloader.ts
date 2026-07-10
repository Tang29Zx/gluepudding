import { staticAssetUrl } from "./staticAssetUrl";

export interface StartupAssetProgress {
  completed: number;
  currentLabel: string;
  failedAttempts: number;
  total: number;
}

interface StartupAsset {
  label: string;
  path: string;
}

const startupAssets: StartupAsset[] = [
  { label: "world island", path: "/models/world/island.glb" },
  { label: "laboratory dome", path: "/models/laboratory/dome.glb" },
  { label: "laboratory floor", path: "/models/laboratory/glass_floor.glb" },
  { label: "laboratory teleporter", path: "/models/laboratory/teleporter.glb" },
  { label: "gomoku board", path: "/models/gomoku/gomoku_board.glb" },
  { label: "gomoku black stone", path: "/models/gomoku/black_stone.glb" },
  { label: "gomoku white stone", path: "/models/gomoku/white_stone.glb" },
  { label: "tarot tent", path: "/models/fortune/tarot_tent.glb" },
  { label: "tarot magic circle", path: "/models/fortune/tarot_magic_circle.glb" },
  { label: "tarot table", path: "/models/fortune/tarot_table.glb" },
  { label: "tarot table cloth", path: "/models/fortune/tarot_table_cloth.glb" },
  { label: "tarot candle", path: "/models/fortune/tarot_candle_stand.glb" },
  { label: "tarot crystal base", path: "/models/fortune/tarot_crystal_base.glb" },
  { label: "tarot crystal ball", path: "/models/fortune/tarot_crystal_ball.glb" },
  { label: "tarot sample card", path: "/models/fortune/tarot_card_sample_major_00_fool.glb" },
  { label: "zodiac dome", path: "/models/fortune/zodiac_star_dome.glb" },
  { label: "zodiac wheel", path: "/models/fortune/zodiac_wheel.glb" },
  { label: "iching table", path: "/models/fortune/iching_table.glb" },
  { label: "iching floor pattern", path: "/models/fortune/iching_floor_pattern.glb" },
  { label: "iching cylinder", path: "/models/fortune/iching_lot_cylinder.glb" },
  { label: "iching coin", path: "/models/fortune/iching_coin.glb" },
  { label: "iching bamboo slips", path: "/models/fortune/iching_bamboo_slips.glb" },
  { label: "iching line", path: "/models/fortune/iching_line_yang.glb" },
  { label: "loading music", path: "/audio/loading_bgm.mp3" },
  { label: "world music", path: "/audio/world_bgm.mp3" },
  { label: "fortune music", path: "/audio/fortune_bgm.mp3" },
];

const tarotTextureSlugs = [
  "fool",
  "magician",
  "high_priestess",
  "empress",
  "emperor",
  "hierophant",
  "lovers",
  "chariot",
  "strength",
  "hermit",
  "wheel_of_fortune",
  "justice",
  "hanged_man",
  "death",
  "temperance",
  "devil",
  "tower",
  "star",
  "moon",
  "sun",
  "judgement",
  "world",
] as const;

const startupTextureAssets: StartupAsset[] = tarotTextureSlugs.map(
  (slug, index) => ({
    label: `tarot card ${index}`,
    path: `/textures/tarot/major_${String(index).padStart(2, "0")}_${slug}.jpg`,
  }),
);

const startupAssetManifest = [...startupAssets, ...startupTextureAssets];
const maxAttempts = Number.POSITIVE_INFINITY;
const retryBaseDelayMs = 1800;
const retryMaxDelayMs = 15000;

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

async function drainResponse(response: Response): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    await response.arrayBuffer();
    return;
  }

  while (true) {
    const result = await reader.read();

    if (result.done) {
      return;
    }
  }
}

async function preloadOneAsset(asset: StartupAsset, signal: AbortSignal) {
  const response = await fetch(staticAssetUrl(asset.path), {
    cache: "force-cache",
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(`${asset.path} returned ${response.status}`);
  }

  await drainResponse(response);
}

export async function preloadStartupAssets(
  onProgress: (progress: StartupAssetProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  let completed = 0;
  let failedAttempts = 0;
  const total = startupAssetManifest.length;

  for (const asset of startupAssetManifest) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      onProgress({
        completed,
        currentLabel: asset.label,
        failedAttempts,
        total,
      });

      try {
        await preloadOneAsset(asset, signal);
        completed += 1;
        onProgress({
          completed,
          currentLabel: asset.label,
          failedAttempts,
          total,
        });
        break;
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }

        failedAttempts += 1;

        if (attempt === maxAttempts) {
          throw error;
        }

        await wait(Math.min(retryBaseDelayMs * attempt, retryMaxDelayMs), signal);
      }
    }
  }
}
