import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { Vector3 } from "three";
import {
  playerControls,
  playerSpawn,
  worldScale,
  type PlayerSpawn,
} from "./sceneConfig";

export interface PlayerControllerState {
  spawn: PlayerSpawn;
  isMovementEnabled: boolean;
  pitch: MutableRefObject<number>;
  position: MutableRefObject<Vector3>;
  yaw: MutableRefObject<number>;
  clearMovementInput: () => void;
  clearMovement: () => void;
  rotateView: (movementX: number, movementY: number) => void;
}

interface UsePlayerControllerOptions {
  isMovementEnabled: boolean;
}

type MovementKey = "KeyW" | "KeyA" | "KeyS" | "KeyD";
type SprintKey = "ShiftLeft" | "ShiftRight";

const movementKeys = new Set<string>(["KeyW", "KeyA", "KeyS", "KeyD"]);
const sprintKeys = new Set<string>(["ShiftLeft", "ShiftRight"]);
const emptyMovementKeys = new Set<MovementKey>();
const emptySprintKeys = new Set<SprintKey>();
const forwardVector = new Vector3();
const rightVector = new Vector3();
const movementVector = new Vector3();
const candidatePosition = new Vector3();

function isMovementKey(code: string): code is MovementKey {
  return movementKeys.has(code);
}

function isSprintKey(code: string): code is SprintKey {
  return sprintKeys.has(code);
}

function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();

  return (
    element.isContentEditable ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea"
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function writeHorizontalVelocity(
  activeKeys: Set<MovementKey>,
  sprintKeys: Set<SprintKey>,
  yaw: number,
  target: Vector3,
): void {
  target.set(0, 0, 0);

  if (activeKeys.size === 0) {
    return;
  }

  forwardVector.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  rightVector.set(Math.cos(yaw), 0, -Math.sin(yaw));
  movementVector.set(0, 0, 0);

  if (activeKeys.has("KeyW")) {
    movementVector.add(forwardVector);
  }

  if (activeKeys.has("KeyS")) {
    movementVector.sub(forwardVector);
  }

  if (activeKeys.has("KeyD")) {
    movementVector.add(rightVector);
  }

  if (activeKeys.has("KeyA")) {
    movementVector.sub(rightVector);
  }

  if (movementVector.lengthSq() === 0) {
    return;
  }

  const speedMultiplier =
    sprintKeys.size > 0 ? playerControls.sprintMultiplier : 1;

  target
    .copy(movementVector)
    .normalize()
    .multiplyScalar(playerControls.moveSpeed * speedMultiplier);
}

export function usePlayerController({
  isMovementEnabled,
}: UsePlayerControllerOptions): PlayerControllerState {
  const activeKeysRef = useRef<Set<MovementKey>>(new Set());
  const horizontalVelocityRef = useRef(new Vector3());
  const jumpBufferTimerRef = useRef(0);
  const pitchRef = useRef(0);
  const positionRef = useRef(new Vector3(...playerSpawn.position));
  const sprintKeysRef = useRef<Set<SprintKey>>(new Set());
  const verticalVelocityRef = useRef(0);
  const yawRef = useRef(0);

  const clearMovementInput = useCallback(() => {
    activeKeysRef.current.clear();
    jumpBufferTimerRef.current = 0;
    sprintKeysRef.current.clear();
  }, []);

  const clearMovement = useCallback(() => {
    clearMovementInput();
    horizontalVelocityRef.current.set(0, 0, 0);
  }, [clearMovementInput]);

  const rotateView = useCallback((movementX: number, movementY: number) => {
    if (!isMovementEnabled) {
      return;
    }

    yawRef.current -= movementX * playerControls.lookSensitivity;
    pitchRef.current = clamp(
      pitchRef.current - movementY * playerControls.lookSensitivity,
      playerControls.minPitch,
      playerControls.maxPitch,
    );
  }, [isMovementEnabled]);

  useEffect(() => {
    if (!isMovementEnabled) {
      clearMovementInput();
    }
  }, [clearMovementInput, isMovementEnabled]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        if (isMovementEnabled) {
          clearMovement();
        } else {
          clearMovementInput();
        }
        return;
      }

      if (!isMovementEnabled) {
        return;
      }

      if (isEditableElement(document.activeElement)) {
        return;
      }

      if (isMovementKey(event.code)) {
        event.preventDefault();
        activeKeysRef.current.add(event.code);
        return;
      }

      if (isSprintKey(event.code)) {
        event.preventDefault();
        sprintKeysRef.current.add(event.code);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();

        if (!event.repeat) {
          jumpBufferTimerRef.current = playerControls.jumpBufferSeconds;
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isMovementEnabled) {
        return;
      }

      if (isMovementKey(event.code)) {
        event.preventDefault();
        activeKeysRef.current.delete(event.code);
      }

      if (isSprintKey(event.code)) {
        event.preventDefault();
        sprintKeysRef.current.delete(event.code);
      }

      if (event.code === "Space") {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearMovement);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearMovement);
    };
  }, [clearMovement, clearMovementInput, isMovementEnabled]);

  useFrame((_, delta) => {
    const activeKeys = isMovementEnabled
      ? activeKeysRef.current
      : emptyMovementKeys;
    const sprintKeys = isMovementEnabled
      ? sprintKeysRef.current
      : emptySprintKeys;
    const groundY = playerSpawn.position[1];
    const horizontalVelocity = horizontalVelocityRef.current;
    let isGrounded =
      positionRef.current.y <= groundY && verticalVelocityRef.current <= 0;

    if (isGrounded) {
      positionRef.current.y = groundY;
      verticalVelocityRef.current = 0;
      writeHorizontalVelocity(
        activeKeys,
        sprintKeys,
        yawRef.current,
        horizontalVelocity,
      );
    }

    if (
      jumpBufferTimerRef.current > 0 &&
      isGrounded
    ) {
      verticalVelocityRef.current = playerControls.jumpVelocity;
      jumpBufferTimerRef.current = 0;
      isGrounded = false;
    }

    if (jumpBufferTimerRef.current > 0) {
      jumpBufferTimerRef.current = Math.max(0, jumpBufferTimerRef.current - delta);
    }

    if (!isGrounded) {
      verticalVelocityRef.current -= playerControls.gravity * delta;
      positionRef.current.y += verticalVelocityRef.current * delta;

      if (positionRef.current.y <= groundY) {
        positionRef.current.y = groundY;
        verticalVelocityRef.current = 0;
        isGrounded = true;
        writeHorizontalVelocity(
          activeKeys,
          sprintKeys,
          yawRef.current,
          horizontalVelocity,
        );

        if (jumpBufferTimerRef.current > 0) {
          verticalVelocityRef.current = playerControls.jumpVelocity;
          jumpBufferTimerRef.current = 0;
          isGrounded = false;
        }
      }
    }

    if (horizontalVelocity.lengthSq() === 0) {
      return;
    }

    candidatePosition
      .copy(positionRef.current)
      .addScaledVector(horizontalVelocity, delta);

    const maxDistanceFromCenter = worldScale.groundRadius - playerSpawn.radius;
    const distanceFromCenter = Math.hypot(candidatePosition.x, candidatePosition.z);

    if (distanceFromCenter > maxDistanceFromCenter) {
      const scale = maxDistanceFromCenter / distanceFromCenter;
      candidatePosition.x *= scale;
      candidatePosition.z *= scale;
    }

    candidatePosition.y = positionRef.current.y;
    positionRef.current.copy(candidatePosition);
  });

  return {
    clearMovement,
    clearMovementInput,
    isMovementEnabled,
    pitch: pitchRef,
    position: positionRef,
    rotateView,
    spawn: playerSpawn,
    yaw: yawRef,
  };
}
