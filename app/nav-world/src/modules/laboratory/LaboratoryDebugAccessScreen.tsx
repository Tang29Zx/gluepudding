import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import {
  DoubleSide,
  Mesh,
  Raycaster,
  Vector2,
} from "three";
import {
  playerSpawn,
  type Vector3Tuple,
} from "../../world/sceneConfig";

export interface AimedLaboratoryDebugControl {
  id: "laboratory-debug-access";
  label: string;
}

interface LaboratoryDebugAccessScreenProps {
  isDebugAccessEnabled: boolean;
  isVisible: boolean;
  onAimedControlChange: (
    control: AimedLaboratoryDebugControl | null,
  ) => void;
  onToggleDebugAccess: () => void;
}

const screenCenter = new Vector2(0, 0);
const screenPosition: Vector3Tuple = [2.6, 2.55, 26.2];
const screenSize = [3.15, 1.64] as const;

function getYawForLocalPositiveZToFace(from: Vector3Tuple, to: Vector3Tuple) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

const screenRotation: Vector3Tuple = [
  0,
  getYawForLocalPositiveZToFace(screenPosition, [
    playerSpawn.position[0],
    screenPosition[1],
    playerSpawn.position[2],
  ]),
  0,
];

export function LaboratoryDebugAccessScreen({
  isDebugAccessEnabled,
  isVisible,
  onAimedControlChange,
  onToggleDebugAccess,
}: LaboratoryDebugAccessScreenProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const aimedRef = useRef(false);
  const buttonMeshRef = useRef<Mesh | null>(null);
  const raycasterRef = useRef(new Raycaster());

  const setAimed = useCallback(
    (isAimed: boolean) => {
      if (aimedRef.current === isAimed) {
        return;
      }

      aimedRef.current = isAimed;
      onAimedControlChange(
        isAimed
          ? {
              id: "laboratory-debug-access",
              label: "测试登录切换",
            }
          : null,
      );
    },
    [onAimedControlChange],
  );

  useEffect(() => {
    if (!isVisible) {
      setAimed(false);
    }
  }, [isVisible, setAimed]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!isVisible || event.button !== 0 || !aimedRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onToggleDebugAccess();
    };

    domElement.addEventListener("click", handleClick);

    return () => {
      domElement.removeEventListener("click", handleClick);
    };
  }, [domElement, isVisible, onToggleDebugAccess]);

  useFrame(() => {
    const buttonMesh = buttonMeshRef.current;

    if (!isVisible || !buttonMesh) {
      setAimed(false);
      return;
    }

    raycasterRef.current.setFromCamera(screenCenter, camera);
    setAimed(
      raycasterRef.current.intersectObject(buttonMesh, false).length > 0,
    );
  });

  if (!isVisible) {
    return null;
  }

  const [screenWidth, screenHeight] = screenSize;
  const buttonColor = isDebugAccessEnabled ? "#4dbd99" : "#e7a45a";
  const statusText = isDebugAccessEnabled ? "测试：已登录" : "测试：未登录";
  const actionText = isDebugAccessEnabled ? "切到未登录" : "切到登录";

  return (
    <group position={screenPosition} rotation={screenRotation}>
      <mesh castShadow receiveShadow position={[0, 0, -0.055]}>
        <boxGeometry args={[screenWidth + 0.18, screenHeight + 0.18, 0.12]} />
        <meshStandardMaterial
          color="#dceff5"
          emissive="#d9f4ff"
          emissiveIntensity={0.14}
          metalness={0.16}
          roughness={0.46}
        />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshBasicMaterial
          color="#f8fdff"
          opacity={0.96}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.56, 0.045]}>
        <planeGeometry args={[screenWidth - 0.22, 0.34]} />
        <meshBasicMaterial
          color="#d7f0fb"
          opacity={0.96}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#1a5670"
        fontSize={0.16}
        maxWidth={screenWidth - 0.4}
        position={[0, 0.56, 0.076]}
      >
        临时测试入口
      </Text>
      <Text
        anchorX="center"
        anchorY="middle"
        color={isDebugAccessEnabled ? "#1f8d72" : "#9a6a24"}
        fontSize={0.18}
        maxWidth={screenWidth - 0.42}
        position={[0, 0.15, 0.08]}
      >
        {statusText}
      </Text>
      <mesh ref={buttonMeshRef} position={[0, -0.31, 0.05]}>
        <planeGeometry args={[1.78, 0.4]} />
        <meshBasicMaterial
          color={buttonColor}
          opacity={0.95}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#ffffff"
        fontSize={0.15}
        maxWidth={1.58}
        position={[0, -0.31, 0.086]}
      >
        {actionText}
      </Text>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#668390"
        fontSize={0.105}
        maxWidth={screenWidth - 0.44}
        position={[0, -0.63, 0.078]}
      >
        正式上线后替换为说明 / 关于
      </Text>
    </group>
  );
}
