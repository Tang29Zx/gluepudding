import { staticAssetUrl } from "../../assets/staticAssetUrl";
import type { Vector3Tuple } from "../../world/sceneConfig";

export interface FortuneModelAsset {
  id: string;
  position: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: number | Vector3Tuple;
  url: string;
}

const fortuneModelBaseUrl = "./models/fortune";

export const fortuneAssetLoadingConfig = {
  floorRadius: 8.8,
  floorSurfaceOffset: 0.48,
  interiorLoadRadius: 13.5,
  shellAnchorOffset: [0, 0, 0],
} satisfies {
  floorRadius: number;
  floorSurfaceOffset: number;
  interiorLoadRadius: number;
  shellAnchorOffset: Vector3Tuple;
};

function modelUrl(fileName: string): string {
  return staticAssetUrl(`${fortuneModelBaseUrl}/${fileName}`);
}

const ichingTablePosition = [6, 0.05, 0] satisfies Vector3Tuple;
const ichingTableYaw = -Math.PI / 2;

function positionOnIchingTable(
  offsetX: number,
  y: number,
  offsetZ: number,
): Vector3Tuple {
  const cos = Math.cos(ichingTableYaw);
  const sin = Math.sin(ichingTableYaw);

  return [
    ichingTablePosition[0] + offsetX * cos + offsetZ * sin,
    y,
    ichingTablePosition[2] - offsetX * sin + offsetZ * cos,
  ];
}

function rotationOnIchingTable(yawOffset = 0, roll = 0): Vector3Tuple {
  return [0, ichingTableYaw + yawOffset, roll];
}

export const fortuneModelAssets = {
  shellAssets: [
    {
      id: "tarot-tent",
      position: [0, 0, 0],
      scale: [2.84, 2.13, 2.84],
      url: modelUrl("tarot_tent.glb"),
    },
    {
      id: "tarot-magic-circle",
      position: [0, 0.52, 0],
      scale: 4.4,
      url: modelUrl("tarot_magic_circle.glb"),
    },
  ],
  interiorAssets: [
    {
      id: "tarot-table",
      position: [0, 0.05, 4.15],
      scale: 1.05,
      url: modelUrl("tarot_table.glb"),
    },
    {
      id: "tarot-table-cloth",
      position: [0, 1.06, 4.15],
      scale: 1.08,
      url: modelUrl("tarot_table_cloth.glb"),
    },
    {
      id: "tarot-candle-left",
      position: [-1.18, 1.28, 4.18],
      rotation: [0, -0.18, 0],
      scale: 0.92,
      url: modelUrl("tarot_candle_stand.glb"),
    },
    {
      id: "tarot-candle-right",
      position: [1.18, 1.28, 4.18],
      rotation: [0, 0.18, 0],
      scale: 0.92,
      url: modelUrl("tarot_candle_stand.glb"),
    },
    {
      id: "tarot-crystal-base",
      position: [0, 1.25, 3.72],
      scale: 0.72,
      url: modelUrl("tarot_crystal_base.glb"),
    },
    {
      id: "tarot-crystal-ball",
      position: [0, 1.42, 3.72],
      scale: 0.62,
      url: modelUrl("tarot_crystal_ball.glb"),
    },
    {
      id: "tarot-card-fool-sample",
      position: [0, 1.285, 4.45],
      rotation: [0, 0.16, 0],
      scale: 0.88,
      url: modelUrl("tarot_card_sample_major_00_fool.glb"),
    },
    {
      id: "zodiac-star-dome",
      position: [0, 6.85, -0.55],
      scale: 1.62,
      url: modelUrl("zodiac_star_dome.glb"),
    },
    {
      id: "zodiac-wheel-floor",
      position: [-6, 0.51, 0],
      url: modelUrl("zodiac_wheel.glb"),
    },
    {
      id: "iching-table",
      position: ichingTablePosition,
      rotation: rotationOnIchingTable(),
      scale: 0.95,
      url: modelUrl("iching_table.glb"),
    },
    {
      id: "iching-floor-pattern",
      position: positionOnIchingTable(0, 1.105, 0),
      rotation: rotationOnIchingTable(),
      scale: 0.27,
      url: modelUrl("iching_floor_pattern.glb"),
    },
    {
      id: "iching-lot-cylinder",
      position: positionOnIchingTable(0, 1.14, 0),
      rotation: rotationOnIchingTable(),
      scale: 0.68,
      url: modelUrl("iching_lot_cylinder.glb"),
    },
    {
      id: "iching-coin",
      position: positionOnIchingTable(0.48, 1.112, 0.22),
      rotation: rotationOnIchingTable(0, 0.2),
      scale: 0.58,
      url: modelUrl("iching_coin.glb"),
    },
    {
      id: "iching-bamboo-slips",
      position: positionOnIchingTable(0.05, 1.68, 0.02),
      rotation: [-Math.PI / 2, 0, 0],
      scale: 0.84,
      url: modelUrl("iching_bamboo_slips.glb"),
    },
    {
      id: "iching-yang-line",
      position: positionOnIchingTable(-0.04, 1.68, -0.04),
      rotation: [0, ichingTableYaw, Math.PI / 2],
      scale: 0.78,
      url: modelUrl("iching_line_yang.glb"),
    },
  ],
} satisfies {
  shellAssets: FortuneModelAsset[];
  interiorAssets: FortuneModelAsset[];
};
