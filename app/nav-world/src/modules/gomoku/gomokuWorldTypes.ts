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
  boardHalfSize: 1.3013333334,
  boardGridSurfaceHeight: 0.0905,
  boardVisualLift: 0.016,
  boardModelHeight: 0.116,
  maxPlacementHeightDelta: 0.55,
  placementSearchRadius: 3.6,
  screenDepth: 2.6026666668,
  screenGap: 0.22,
  screenThickness: 0.08,
  screenWidth: 1.72,
  walkableEdgeBlend: 0.46,
} as const;

export const gomokuScreenCenterX =
  gomokuBoardConfig.boardHalfSize +
  gomokuBoardConfig.screenGap +
  gomokuBoardConfig.screenWidth / 2;

export const gomokuBoardSurfaceHeight =
  gomokuBoardConfig.boardVisualLift + gomokuBoardConfig.boardModelHeight;

export const gomokuBoardPlaySurfaceHeight =
  gomokuBoardConfig.boardVisualLift + gomokuBoardConfig.boardGridSurfaceHeight;

export const gomokuScreenSurfaceHeight = gomokuBoardSurfaceHeight;

const gomokuSurfaceNormal = new Vector3(0, 1, 0);

const gomokuWalkableBounds = {
  maxX: gomokuScreenCenterX + gomokuBoardConfig.screenWidth / 2,
  maxZ: Math.max(
    gomokuBoardConfig.boardHalfSize,
    gomokuBoardConfig.screenDepth / 2,
  ),
  minX: -gomokuBoardConfig.boardHalfSize,
  minZ: -Math.max(
    gomokuBoardConfig.boardHalfSize,
    gomokuBoardConfig.screenDepth / 2,
  ),
} as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);

  return clamped * clamped * (3 - 2 * clamped);
}

function getDistanceOutsideWalkableBounds(localX: number, localZ: number): number {
  const distanceX = Math.max(
    gomokuWalkableBounds.minX - localX,
    0,
    localX - gomokuWalkableBounds.maxX,
  );
  const distanceZ = Math.max(
    gomokuWalkableBounds.minZ - localZ,
    0,
    localZ - gomokuWalkableBounds.maxZ,
  );

  return Math.hypot(distanceX, distanceZ);
}

function isInsideWalkableBounds(localX: number, localZ: number): boolean {
  return (
    localX >= gomokuWalkableBounds.minX &&
    localX <= gomokuWalkableBounds.maxX &&
    localZ >= gomokuWalkableBounds.minZ &&
    localZ <= gomokuWalkableBounds.maxZ
  );
}

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
  baseGround?: TerrainSample | null,
): TerrainSample | null {
  if (!placement) {
    return null;
  }

  const local = worldToGomokuLocal(placement, x, z);
  const surfaceY = placement.center[1] + gomokuBoardSurfaceHeight;

  if (isInsideWalkableBounds(local.x, local.z)) {
    return {
      normal: gomokuSurfaceNormal,
      y: surfaceY,
    };
  }

  if (!baseGround || baseGround.y >= surfaceY) {
    return null;
  }

  const distanceOutside = getDistanceOutsideWalkableBounds(local.x, local.z);

  if (distanceOutside > gomokuBoardConfig.walkableEdgeBlend) {
    return null;
  }

  const blend =
    1 - smoothstep(distanceOutside / gomokuBoardConfig.walkableEdgeBlend);

  return {
    normal: gomokuSurfaceNormal,
    y: baseGround.y + (surfaceY - baseGround.y) * blend,
  };
}
