export type Vector3Tuple = [number, number, number];

export interface PlayerSpawn {
  position: Vector3Tuple;
  eyeHeight: number;
  height: number;
  radius: number;
}

export const playerSpawn: PlayerSpawn = {
  position: [0, 0, 8],
  eyeHeight: 1.65,
  height: 1.72,
  radius: 0.32,
};

export const cameraConfig = {
  position: [0, playerSpawn.eyeHeight, 8] satisfies Vector3Tuple,
  target: [0, 1.55, -34] satisfies Vector3Tuple,
  fov: 62,
  near: 0.1,
  far: 220,
};

export const playerControls = {
  gravity: 34,
  jumpBufferSeconds: 0.12,
  jumpVelocity: 8.8,
  lookSensitivity: 0.0022,
  maxPitch: Math.PI / 2.8,
  minPitch: -Math.PI / 2.8,
  moveSpeed: 8.5,
  sprintMultiplier: 1.75,
};

export const worldScale = {
  groundRadius: 95,
  gridSize: 190,
  gridDivisions: 95,
};

export const landmarkPositions = {
  divinationHouse: [0, 0, -34] satisfies Vector3Tuple,
  laboratory: [26, 0, -46] satisfies Vector3Tuple,
  gomokuBoard: [-24, 0, -24] satisfies Vector3Tuple,
};

export const worldColors = {
  sky: "#dff4ff",
  ground: "#96d9b4",
  grid: "#6ab6c5",
  player: "#ef7aa8",
  playerAccent: "#fffefd",
  lab: "#77aee8",
  divination: "#a99bea",
  gomoku: "#ffd977",
};
