import { Vector3 } from "three";
import {
  fortuneRoomConfig,
  getFortuneDoorWorldPosition,
  getFortuneStagePosition,
} from "./fortuneRoomConfig";
import { landmarkPositions, playerSpawn } from "./sceneConfig";
import type { TerrainSample } from "./terrainSampler";

interface BaseCollisionVolume {
  centerX: number;
  centerZ: number;
  maxY: number;
  minY: number;
  openingCenterAngle?: number;
  openingHalfAngle?: number;
}

interface CircularAnnularCollisionVolume extends BaseCollisionVolume {
  innerRadius: number;
  outerRadius: number;
}

interface EllipticalAnnularCollisionVolume extends BaseCollisionVolume {
  innerRadiusX: number;
  innerRadiusZ: number;
  outerRadiusX: number;
  outerRadiusZ: number;
}

type CollisionVolume =
  | CircularAnnularCollisionVolume
  | EllipticalAnnularCollisionVolume;

export type LaboratoryTeleportDirection = "up" | "down";

const laboratoryShellScale = 6;
const teleporterScale = 1.95;
const teleporterAssetBottomY = -0.07887;
const teleporterAssetHeight = 2.99132 - -0.07887;
const teleporterAssetOuterRadius = 2.5;
const teleporterAssetOuterDepth = 1.85;
const teleporterAssetInnerRadius = 0.85;
const teleporterAssetCollisionRimWidth = 0.28;
const laboratoryFloorAssetRadius = 2.24;
const laboratoryBorderAssetWidth = 0.15;
const laboratoryHeadClearanceInset = 1.05;
const laboratoryFloorBottomY = -0.09 * laboratoryShellScale;
const laboratoryFloorTopY = 0.035 * laboratoryShellScale;
const teleporterDoorOpeningHalfAngle = Math.PI / 3;
const teleporterSurfaceNormal = new Vector3(0, 1, 0);
const aerialLaboratoryReferencePadding = 3.5;
const teleporterActivationVerticalTolerance = 1.25;

const teleporterWalkableProfile = [
  { minLocalAssetX: 2.22, surfaceAssetY: 0.02 },
  { minLocalAssetX: 1.82, surfaceAssetY: 0.17 },
  { minLocalAssetX: 1.38, surfaceAssetY: 0.24 },
  { minLocalAssetX: 0.74, surfaceAssetY: 0.44 },
  { minLocalAssetX: -0.18, surfaceAssetY: 0.49 },
  { minLocalAssetX: -1.52, surfaceAssetY: 0.72 },
] as const;
const teleporterCenterPlatformAssetY =
  teleporterWalkableProfile[teleporterWalkableProfile.length - 1].surfaceAssetY;
const teleporterActivationRadius =
  teleporterAssetInnerRadius * teleporterScale;

function getAngleToSpawn(centerX: number, centerZ: number): number {
  return Math.atan2(
    playerSpawn.position[2] - centerZ,
    playerSpawn.position[0] - centerX,
  );
}

function worldToTeleporterLocal(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
): { localX: number; localZ: number } {
  const angleToSpawn = getAngleToSpawn(centerX, centerZ);
  const offsetX = x - centerX;
  const offsetZ = z - centerZ;
  const cos = Math.cos(angleToSpawn);
  const sin = Math.sin(angleToSpawn);

  return {
    localX: offsetX * cos + offsetZ * sin,
    localZ: -offsetX * sin + offsetZ * cos,
  };
}

function worldToTeleporterAssetLocal(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
): { localX: number; localZ: number } {
  const local = worldToTeleporterLocal(x, z, centerX, centerZ);

  return {
    localX: local.localX / teleporterScale,
    localZ: local.localZ / teleporterScale,
  };
}

function getLaboratoryFloorInnerRadius(): number {
  return (
    laboratoryFloorAssetRadius * laboratoryShellScale -
    laboratoryBorderAssetWidth * laboratoryShellScale -
    laboratoryHeadClearanceInset
  );
}

function getAerialLaboratoryFloorY(): number {
  return landmarkPositions.laboratory[1] + laboratoryFloorTopY;
}

function getTeleporterSurfaceY(
  teleporterFloorY: number,
  assetSurfaceY: number,
): number {
  return (
    teleporterFloorY -
    teleporterAssetBottomY * teleporterScale +
    assetSurfaceY * teleporterScale
  );
}

function getTeleporterCenterSurfaceY(teleporterFloorY: number): number {
  return getTeleporterSurfaceY(
    teleporterFloorY,
    teleporterCenterPlatformAssetY,
  );
}

function getEntryLaneHalfWidthAsset(localAssetX: number): number {
  if (localAssetX > 1.85) {
    return 0.55;
  }

  if (localAssetX > 1.25) {
    return 0.9;
  }

  return 1.45;
}

function getGroundTeleporterWalkableAssetY(
  localAssetX: number,
  localAssetZ: number,
): number | null {
  const absLocalAssetZ = Math.abs(localAssetZ);
  const distanceFromCenter = Math.hypot(localAssetX, localAssetZ);

  if (distanceFromCenter <= teleporterAssetInnerRadius) {
    return teleporterWalkableProfile[
      teleporterWalkableProfile.length - 1
    ].surfaceAssetY;
  }

  if (
    localAssetX < -1.62 ||
    localAssetX > teleporterAssetOuterRadius ||
    absLocalAssetZ > getEntryLaneHalfWidthAsset(localAssetX)
  ) {
    return null;
  }

  for (const tier of teleporterWalkableProfile) {
    if (localAssetX >= tier.minLocalAssetX) {
      return tier.surfaceAssetY;
    }
  }

  return teleporterWalkableProfile[
    teleporterWalkableProfile.length - 1
  ].surfaceAssetY;
}

function createCollisionVolumes(): readonly CollisionVolume[] {
  const [
    fortuneStageX,
    fortuneStageY,
    fortuneStageZ,
  ] = getFortuneStagePosition();
  const [
    fortuneDoorX,
    ,
    fortuneDoorZ,
  ] = getFortuneDoorWorldPosition();
  const [
    laboratoryX,
    laboratoryY,
    laboratoryZ,
  ] = landmarkPositions.laboratory;
  const [
    groundTeleporterX,
    groundTeleporterY,
    groundTeleporterZ,
  ] = landmarkPositions.laboratoryGroundTeleporter;
  const teleporterOuterRadiusX =
    teleporterAssetOuterRadius * teleporterScale;
  const teleporterOuterRadiusZ =
    teleporterAssetOuterDepth * teleporterScale;
  const teleporterInnerRadiusX =
    (teleporterAssetOuterRadius - teleporterAssetCollisionRimWidth) *
    teleporterScale;
  const teleporterInnerRadiusZ =
    (teleporterAssetOuterDepth - teleporterAssetCollisionRimWidth) *
    teleporterScale;
  const teleporterHeight = teleporterAssetHeight * teleporterScale;
  const laboratoryFloorOuterRadius =
    laboratoryFloorAssetRadius * laboratoryShellScale;
  const laboratoryFloorInnerRadius = getLaboratoryFloorInnerRadius();

  return [
    {
      centerX: fortuneStageX,
      centerZ: fortuneStageZ,
      innerRadius: fortuneRoomConfig.boundaryInnerRadius,
      maxY: fortuneStageY + fortuneRoomConfig.roomCeilingOffset,
      minY: fortuneStageY + fortuneRoomConfig.roomFloorOffset,
      openingCenterAngle: Math.atan2(
        fortuneDoorZ - fortuneStageZ,
        fortuneDoorX - fortuneStageX,
      ),
      openingHalfAngle: fortuneRoomConfig.doorHalfAngle,
      outerRadius: fortuneRoomConfig.boundaryOuterRadius,
    },
    {
      centerX: groundTeleporterX,
      centerZ: groundTeleporterZ,
      innerRadiusX: teleporterInnerRadiusX,
      innerRadiusZ: teleporterInnerRadiusZ,
      maxY: groundTeleporterY + teleporterHeight,
      minY: groundTeleporterY,
      openingCenterAngle: getAngleToSpawn(
        groundTeleporterX,
        groundTeleporterZ,
      ),
      openingHalfAngle: teleporterDoorOpeningHalfAngle,
      outerRadiusX: teleporterOuterRadiusX,
      outerRadiusZ: teleporterOuterRadiusZ,
    },
    {
      centerX: laboratoryX,
      centerZ: laboratoryZ,
      innerRadiusX: teleporterInnerRadiusX,
      innerRadiusZ: teleporterInnerRadiusZ,
      maxY: laboratoryY + laboratoryFloorTopY + teleporterHeight,
      minY: laboratoryY + laboratoryFloorTopY,
      openingCenterAngle: getAngleToSpawn(laboratoryX, laboratoryZ),
      openingHalfAngle: teleporterDoorOpeningHalfAngle,
      outerRadiusX: teleporterOuterRadiusX,
      outerRadiusZ: teleporterOuterRadiusZ,
    },
    {
      centerX: laboratoryX,
      centerZ: laboratoryZ,
      innerRadius: laboratoryFloorInnerRadius,
      maxY: laboratoryY + laboratoryFloorTopY + 1.2,
      minY: laboratoryY + laboratoryFloorBottomY,
      outerRadius: laboratoryFloorOuterRadius,
    },
  ];
}

const collisionVolumes = createCollisionVolumes();

function getSmallestAngleDelta(left: number, right: number): number {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function isWithinOpening(position: Vector3, volume: CollisionVolume): boolean {
  if (
    volume.openingCenterAngle === undefined ||
    volume.openingHalfAngle === undefined
  ) {
    return false;
  }

  const angle = Math.atan2(
    position.z - volume.centerZ,
    position.x - volume.centerX,
  );

  return (
    Math.abs(getSmallestAngleDelta(angle, volume.openingCenterAngle)) <=
    volume.openingHalfAngle
  );
}

function overlapsVerticalRange(
  playerY: number,
  playerHeight: number,
  volume: CollisionVolume,
): boolean {
  const playerMinY = playerY;
  const playerMaxY = playerY + playerHeight;

  return playerMaxY >= volume.minY && playerMinY <= volume.maxY;
}

function isCircularVolume(
  volume: CollisionVolume,
): volume is CircularAnnularCollisionVolume {
  return "innerRadius" in volume;
}

function getEllipseDistance(
  localX: number,
  localZ: number,
  radiusX: number,
  radiusZ: number,
): number {
  return Math.hypot(localX / radiusX, localZ / radiusZ);
}

function getCircularAnnularPenetration(
  position: Vector3,
  playerRadius: number,
  volume: CircularAnnularCollisionVolume,
): number {
  if (isWithinOpening(position, volume)) {
    return 0;
  }

  const distance = Math.hypot(
    position.x - volume.centerX,
    position.z - volume.centerZ,
  );
  const outsideInnerEdge = distance + playerRadius - volume.innerRadius;
  const insideOuterEdge = volume.outerRadius - (distance - playerRadius);

  if (outsideInnerEdge <= 0 || insideOuterEdge <= 0) {
    return 0;
  }

  return Math.min(outsideInnerEdge, insideOuterEdge);
}

function getEllipticalAnnularPenetration(
  position: Vector3,
  playerRadius: number,
  volume: EllipticalAnnularCollisionVolume,
): number {
  if (isWithinOpening(position, volume)) {
    return 0;
  }

  const local = worldToTeleporterLocal(
    position.x,
    position.z,
    volume.centerX,
    volume.centerZ,
  );
  const outerDistance = getEllipseDistance(
    local.localX,
    local.localZ,
    volume.outerRadiusX + playerRadius,
    volume.outerRadiusZ + playerRadius,
  );
  const innerDistance = getEllipseDistance(
    local.localX,
    local.localZ,
    Math.max(0.001, volume.innerRadiusX - playerRadius),
    Math.max(0.001, volume.innerRadiusZ - playerRadius),
  );

  if (outerDistance >= 1 || innerDistance <= 1) {
    return 0;
  }

  return Math.min(1 - outerDistance, innerDistance - 1);
}

function getCollisionPenetration(
  position: Vector3,
  playerRadius: number,
  volume: CollisionVolume,
): number {
  if (isCircularVolume(volume)) {
    return getCircularAnnularPenetration(position, playerRadius, volume);
  }

  return getEllipticalAnnularPenetration(position, playerRadius, volume);
}

export function isWorldMovementBlocked(
  currentPosition: Vector3,
  candidatePosition: Vector3,
  playerRadius: number,
  playerHeight: number,
): boolean {
  for (const volume of collisionVolumes) {
    if (!overlapsVerticalRange(candidatePosition.y, playerHeight, volume)) {
      continue;
    }

    const candidatePenetration = getCollisionPenetration(
      candidatePosition,
      playerRadius,
      volume,
    );

    if (candidatePenetration <= 0) {
      continue;
    }

    const currentPenetration = overlapsVerticalRange(
      currentPosition.y,
      playerHeight,
      volume,
    )
      ? getCollisionPenetration(currentPosition, playerRadius, volume)
      : 0;

    if (candidatePenetration > currentPenetration + 0.001) {
      return true;
    }
  }

  return false;
}

export function sampleLaboratorySurface(
  x: number,
  z: number,
  baseGround?: TerrainSample | null,
  referenceY?: number,
): TerrainSample | null {
  const [
    laboratoryX,
    laboratoryY,
    laboratoryZ,
  ] = landmarkPositions.laboratory;
  const [
    groundTeleporterX,
    groundTeleporterY,
    groundTeleporterZ,
  ] = landmarkPositions.laboratoryGroundTeleporter;
  const aerialFloorY = laboratoryY + laboratoryFloorTopY;

  if (
    referenceY !== undefined &&
    referenceY >= aerialFloorY - aerialLaboratoryReferencePadding
  ) {
    const aerialTeleporterSample = sampleTeleporterSurface(
      x,
      z,
      laboratoryX,
      laboratoryZ,
      aerialFloorY,
    );

    if (aerialTeleporterSample) {
      return aerialTeleporterSample;
    }

    if (
      Math.hypot(x - laboratoryX, z - laboratoryZ) <=
      getLaboratoryFloorInnerRadius()
    ) {
      return {
        normal: teleporterSurfaceNormal,
        y: aerialFloorY,
      };
    }
  }

  if (!baseGround) {
    return null;
  }

  const groundTeleporterSample = sampleTeleporterSurface(
    x,
    z,
    groundTeleporterX,
    groundTeleporterZ,
    groundTeleporterY,
  );

  if (!groundTeleporterSample) {
    return null;
  }

  if (baseGround.y > groundTeleporterSample.y + 0.15) {
    return null;
  }

  return groundTeleporterSample;
}

function sampleTeleporterSurface(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  teleporterFloorY: number,
): TerrainSample | null {
  const local = worldToTeleporterAssetLocal(x, z, centerX, centerZ);
  const walkableAssetY = getGroundTeleporterWalkableAssetY(
    local.localX,
    local.localZ,
  );

  if (walkableAssetY === null) {
    return null;
  }

  return {
    normal: teleporterSurfaceNormal,
    y: getTeleporterSurfaceY(teleporterFloorY, walkableAssetY),
  };
}

function isWithinTeleporterActivation(
  position: Vector3,
  centerX: number,
  centerZ: number,
  teleporterFloorY: number,
): boolean {
  const local = worldToTeleporterLocal(
    position.x,
    position.z,
    centerX,
    centerZ,
  );

  if (Math.hypot(local.localX, local.localZ) > teleporterActivationRadius) {
    return false;
  }

  return (
    Math.abs(position.y - getTeleporterCenterSurfaceY(teleporterFloorY)) <=
    teleporterActivationVerticalTolerance
  );
}

function getAerialTeleporterTarget(): Vector3 {
  const [laboratoryX, , laboratoryZ] = landmarkPositions.laboratory;
  const aerialFloorY = getAerialLaboratoryFloorY();

  return new Vector3(
    laboratoryX,
    getTeleporterCenterSurfaceY(aerialFloorY),
    laboratoryZ,
  );
}

function getGroundTeleporterTarget(): Vector3 {
  const [
    groundTeleporterX,
    groundTeleporterY,
    groundTeleporterZ,
  ] = landmarkPositions.laboratoryGroundTeleporter;

  return new Vector3(
    groundTeleporterX,
    getTeleporterCenterSurfaceY(groundTeleporterY),
    groundTeleporterZ,
  );
}

export function getLaboratoryTeleportTarget(
  position: Vector3,
  direction: LaboratoryTeleportDirection,
): Vector3 | null {
  const [laboratoryX, , laboratoryZ] = landmarkPositions.laboratory;
  const [
    groundTeleporterX,
    groundTeleporterY,
    groundTeleporterZ,
  ] = landmarkPositions.laboratoryGroundTeleporter;
  const aerialFloorY = getAerialLaboratoryFloorY();

  if (direction === "up") {
    if (
      !isWithinTeleporterActivation(
        position,
        groundTeleporterX,
        groundTeleporterZ,
        groundTeleporterY,
      )
    ) {
      return null;
    }

    return getAerialTeleporterTarget();
  }

  if (
    !isWithinTeleporterActivation(
      position,
      laboratoryX,
      laboratoryZ,
      aerialFloorY,
    )
  ) {
    return null;
  }

  return getGroundTeleporterTarget();
}
