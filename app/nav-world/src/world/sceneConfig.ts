import { staticAssetUrl } from "../assets/staticAssetUrl";

export type Vector3Tuple = [number, number, number];

export interface PlayerSpawn {
  position: Vector3Tuple;
  eyeHeight: number;
  height: number;
  radius: number;
}

export const playerSpawn: PlayerSpawn = {
  position: [0, 1.15, 40],
  eyeHeight: 1.65,
  height: 1.72,
  radius: 0.32,
};

export const cameraConfig = {
  position: [0, playerSpawn.position[1] + playerSpawn.eyeHeight, 40] satisfies Vector3Tuple,
  target: [0, 2.1, 18] satisfies Vector3Tuple,
  fov: 62,
  verticalDamping: 16,
  verticalSnapDistance: 4.5,
  verticalMaxFallSpeed: 10,
  verticalMaxRiseSpeed: 8,
  near: 0.1,
  far: 220,
};

export const playerControls = {
  gravity: 34,
  initialPitch: -0.01,
  initialYaw: 0.05,
  jumpBufferSeconds: 0.12,
  jumpGroundDetachSeconds: 0.14,
  jumpVelocity: 8.8,
  lookSensitivity: 0.0022,
  maxPitch: Math.PI / 2.25,
  minPitch: -Math.PI / 2.25,
  moveSpeed: 8.5,
  sprintMultiplier: 1.75,
};

export const worldScale = {
  groundRadius: 95,
  gridSize: 190,
  gridDivisions: 95,
};

export const worldTerrain = {
  modelUrl: staticAssetUrl("./models/world/ground.glb"),
  position: [-14.4, -10, 3.5] satisfies Vector3Tuple,
  scale: 6,
  walkableMeshNames: ["Icosphere"] as const,
  raycastStartY: 80,
  raycastDistance: 180,
  minWalkableNormalY: 0.72,
};

export const worldScenery = {
  decorModelUrl: staticAssetUrl("./models/world/central-decor.glb"),
  sakuraLowModelUrl: staticAssetUrl("./models/world/sakura-tree-low.glb"),
  sakuraMidModelUrl: staticAssetUrl("./models/world/sakura-tree-mid.glb"),
  sakuraHighModelUrl: staticAssetUrl("./models/world/sakura-tree-high.glb"),
};

export const landmarkPositions = {
  divinationHouse: [-12, 2.14, 25] satisfies Vector3Tuple,
  laboratory: [12, 44, 25] satisfies Vector3Tuple,
  laboratoryGroundTeleporter: [12, 1.74, 25] satisfies Vector3Tuple,
  gomokuBoard: [0, 1.36, 24] satisfies Vector3Tuple,
  gameRoom: [8, 1.15, 36] satisfies Vector3Tuple,
};

export const worldColors = {
  sky: "#c8dfdf",
  ground: "#779b73",
  grid: "#6f9f95",
  player: "#ef7aa8",
  playerAccent: "#fffefd",
  lab: "#77aee8",
  divination: "#a99bea",
  gomoku: "#ffd977",
};
