import { playerSpawn, type PlayerSpawn } from "./sceneConfig";

export interface PlayerControllerState {
  spawn: PlayerSpawn;
  isMovementEnabled: false;
}

export function usePlayerController(): PlayerControllerState {
  return {
    spawn: playerSpawn,
    isMovementEnabled: false,
  };
}
