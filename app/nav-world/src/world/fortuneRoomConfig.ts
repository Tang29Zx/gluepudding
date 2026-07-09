import { Vector3 } from "three";
import {
  landmarkPositions,
  type Vector3Tuple,
} from "./sceneConfig";

export type FortuneRoomState = "entering" | "exiting" | "inside" | "outside";

export interface FortuneRoomLocalPoint {
  localX: number;
  localZ: number;
}

export const fortuneRoomConfig = {
  boundaryInnerRadius: 6.7,
  boundaryOuterRadius: 8.8,
  doorHalfAngle: 0.34,
  doorLocalZ: -7.15,
  doorMistHeight: 5.2,
  doorMistWidth: 5,
  enterLandingLocalZ: -4.45,
  enterLocalZ: -5.8,
  exitLandingLocalZ: -8.15,
  exitLocalZ: -7.35,
  floorRadius: 8.8,
  landingHalfWidth: 0.6,
  roomCeilingOffset: 7.4,
  roomFloorOffset: 0.48,
  shellYaw: -2.47,
  transitionCoverMs: 120,
  transitionRevealMs: 1100,
} as const;

const stagePosition = new Vector3(...landmarkPositions.divinationHouse);

export function getFortuneStagePosition(): Vector3Tuple {
  return [stagePosition.x, stagePosition.y, stagePosition.z];
}

export function getFortuneDoorWorldPosition(): Vector3Tuple {
  const doorLocal = fortuneLocalToWorld(0, fortuneRoomConfig.doorLocalZ);

  return [
    doorLocal.x,
    stagePosition.y + fortuneRoomConfig.roomFloorOffset,
    doorLocal.z,
  ];
}

export function getFortuneAimPosition(): Vector3Tuple {
  const doorPosition = getFortuneDoorWorldPosition();

  return [
    doorPosition[0],
    stagePosition.y + 2.55,
    doorPosition[2],
  ];
}

export function fortuneLocalToWorld(localX: number, localZ: number): Vector3 {
  const cos = Math.cos(fortuneRoomConfig.shellYaw);
  const sin = Math.sin(fortuneRoomConfig.shellYaw);

  return new Vector3(
    stagePosition.x + localX * cos + localZ * sin,
    stagePosition.y,
    stagePosition.z - localX * sin + localZ * cos,
  );
}

export function fortuneWorldToLocal(
  x: number,
  z: number,
): FortuneRoomLocalPoint {
  const offsetX = x - stagePosition.x;
  const offsetZ = z - stagePosition.z;
  const cos = Math.cos(fortuneRoomConfig.shellYaw);
  const sin = Math.sin(fortuneRoomConfig.shellYaw);

  return {
    localX: offsetX * cos - offsetZ * sin,
    localZ: offsetX * sin + offsetZ * cos,
  };
}

export function isInsideFortuneRoomByLocal(
  localPoint: FortuneRoomLocalPoint,
): boolean {
  return (
    Math.hypot(localPoint.localX, localPoint.localZ) <=
      fortuneRoomConfig.boundaryInnerRadius &&
    localPoint.localZ > fortuneRoomConfig.enterLocalZ
  );
}

export function isWithinFortuneDoorLane(
  localPoint: FortuneRoomLocalPoint,
): boolean {
  if (
    Math.hypot(localPoint.localX, localPoint.localZ) >
    fortuneRoomConfig.boundaryOuterRadius
  ) {
    return false;
  }

  const angle = Math.atan2(localPoint.localX, -localPoint.localZ);

  return Math.abs(angle) <= fortuneRoomConfig.doorHalfAngle;
}
