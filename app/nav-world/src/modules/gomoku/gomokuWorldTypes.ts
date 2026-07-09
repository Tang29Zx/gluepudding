import { Vector3 } from "three";
import type { TerrainSample } from "../../world/terrainSampler";
import type { Vector3Tuple } from "../../world/sceneConfig";

export type GomokuControlId = "undo" | "restart" | "difficulty" | "retract";

export type GomokuAimTarget =
  | {
      kind: "board";
      label: string;
    }
  | {
      kind: "screen";
      label: string;
    }
  | {
      controlId: GomokuControlId;
      kind: "control";
      label: string;
    };

export interface GomokuPlacement {
  center: Vector3Tuple;
  yaw: number;
}

export const gomokuBoardConfig = {
  boardHalfSize: 1.6266666667,
  boardVisualLift: 0.016,
  boardModelHeight: 0.116,
  maxPlacementHeightDelta: 0.55,
  placementSearchRadius: 3.6,
  screenDepth: 3.2533333334,
  screenGap: 0.22,
  screenThickness: 0.08,
  screenWidth: 1.72,
} as const;

export const gomokuScreenCenterX =
  gomokuBoardConfig.boardHalfSize +
  gomokuBoardConfig.screenGap +
  gomokuBoardConfig.screenWidth / 2;

export const gomokuBoardSurfaceHeight =
  gomokuBoardConfig.boardVisualLift + gomokuBoardConfig.boardModelHeight;

export const gomokuScreenSurfaceHeight = gomokuBoardSurfaceHeight;

const gomokuSurfaceNormal = new Vector3(0, 1, 0);

export function worldToGomokuLocal(
  placement: GomokuPlacement,
  x: number,
  z: number,
): { x: number; z: number } {
  const dx = x - placement.center[0];
  const dz = z - placement.center[2];
  const cos = Math.cos(placement.yaw);
  const sin = Math.sin(placement.yaw);

  return {
    x: cos * dx - sin * dz,
    z: sin * dx + cos * dz,
  };
}

export function gomokuLocalToWorld(
  placement: GomokuPlacement,
  localX: number,
  localZ: number,
): { x: number; z: number } {
  const cos = Math.cos(placement.yaw);
  const sin = Math.sin(placement.yaw);

  return {
    x: placement.center[0] + cos * localX + sin * localZ,
    z: placement.center[2] - sin * localX + cos * localZ,
  };
}

export function isPointOnGomokuBoard(
  placement: GomokuPlacement,
  x: number,
  z: number,
): boolean {
  const local = worldToGomokuLocal(placement, x, z);

  return (
    Math.abs(local.x) <= gomokuBoardConfig.boardHalfSize &&
    Math.abs(local.z) <= gomokuBoardConfig.boardHalfSize
  );
}

export function isPointOnGomokuScreen(
  placement: GomokuPlacement,
  x: number,
  z: number,
): boolean {
  const local = worldToGomokuLocal(placement, x, z);

  return (
    Math.abs(local.x - gomokuScreenCenterX) <=
      gomokuBoardConfig.screenWidth / 2 &&
    Math.abs(local.z) <= gomokuBoardConfig.screenDepth / 2
  );
}

export function sampleGomokuSurface(
  placement: GomokuPlacement | null,
  x: number,
  z: number,
): TerrainSample | null {
  if (!placement) {
    return null;
  }

  if (isPointOnGomokuScreen(placement, x, z)) {
    return {
      normal: gomokuSurfaceNormal,
      y: placement.center[1] + gomokuScreenSurfaceHeight,
    };
  }

  if (isPointOnGomokuBoard(placement, x, z)) {
    return {
      normal: gomokuSurfaceNormal,
      y: placement.center[1] + gomokuBoardSurfaceHeight,
    };
  }

  return null;
}
