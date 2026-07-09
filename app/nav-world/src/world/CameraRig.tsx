import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { PlayerControllerState } from "./PlayerController";
import { cameraConfig } from "./sceneConfig";

interface CameraRigProps {
  player: PlayerControllerState;
}

export function CameraRig({ player }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const isPointerLockedRef = useRef(false);
  const smoothedCameraYRef = useRef<number | null>(null);
  const { clearMovement, clearMovementInput, rotateView } = player;

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  useEffect(() => {
    const requestPointerLock = () => {
      if (!player.isMovementEnabled) {
        return;
      }

      if (document.pointerLockElement === domElement) {
        return;
      }

      try {
        void Promise.resolve(domElement.requestPointerLock()).catch(() => {
          console.warn("Pointer lock unavailable; 3D world remains active.");
        });
      } catch {
        console.warn("Pointer lock unavailable; 3D world remains active.");
      }
    };

    const handlePointerLockChange = () => {
      isPointerLockedRef.current = document.pointerLockElement === domElement;

      if (!isPointerLockedRef.current) {
        clearMovementInput();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isPointerLockedRef.current || !player.isMovementEnabled) {
        return;
      }

      rotateView(event.movementX, event.movementY);
    };

    const handlePointerLockError = () => {
      console.warn("Pointer lock unavailable; 3D world remains active.");
    };

    domElement.addEventListener("click", requestPointerLock);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    return () => {
      domElement.removeEventListener("click", requestPointerLock);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
    };
  }, [clearMovementInput, domElement, player.isMovementEnabled, rotateView]);

  useEffect(() => {
    return () => {
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    };
  }, [domElement]);

  useEffect(() => {
    if (player.isMovementEnabled || document.pointerLockElement !== domElement) {
      return;
    }

    document.exitPointerLock();
    clearMovementInput();
  }, [clearMovementInput, domElement, player.isMovementEnabled]);

  useFrame((_, delta) => {
    const { position, pitch, spawn, yaw } = player;
    const targetCameraY = position.current.y + spawn.eyeHeight;
    const currentCameraY = smoothedCameraYRef.current;

    if (
      currentCameraY === null ||
      Math.abs(targetCameraY - currentCameraY) >
        cameraConfig.verticalSnapDistance
    ) {
      smoothedCameraYRef.current = targetCameraY;
    } else {
      const followFactor =
        1 - Math.exp(-cameraConfig.verticalDamping * delta);
      const wantedStep = (targetCameraY - currentCameraY) * followFactor;
      const maxStep =
        (wantedStep >= 0
          ? cameraConfig.verticalMaxRiseSpeed
          : cameraConfig.verticalMaxFallSpeed) * delta;
      const nextStep = Math.min(
        Math.abs(wantedStep),
        maxStep,
      ) * Math.sign(wantedStep);

      smoothedCameraYRef.current = currentCameraY + nextStep;
    }

    camera.position.set(
      position.current.x,
      smoothedCameraYRef.current,
      position.current.z,
    );
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
  });

  return null;
}
