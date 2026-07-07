import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector3 } from "three";
import { cameraConfig } from "./sceneConfig";

export function CameraRig() {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(...cameraConfig.position);
    camera.lookAt(new Vector3(...cameraConfig.target));
  }, [camera]);

  return null;
}
