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
  isVisible: boolean;
  onAimedControlChange: (
    control: AimedLaboratoryDebugControl | null,
  ) => void;
}

const screenCenter = new Vector2(0, 0);
const screenPosition: Vector3Tuple = [2.6, 2.55, 26.2];
const screenSize = [3.3, 1.86] as const;
const copyrightNoticeLines = [
  '"Float Island - low ploy" (https://skfb.ly/oPpL7) by 18gen is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).',
  '"Sci-Fi Teleporter" (https://skfb.ly/pxIX9) by GMT is licensed under Creative Commons Attribution-ShareAlike (http://creativecommons.org/licenses/by-sa/4.0/).',
  '"Sci- Fi / Future Building 2: Simple Dome" (https://skfb.ly/oBvET) by 𝗻𝗲𝗻𝗸𝗲𝗮 is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).',
  'ICP备案号：沪ICP备2026022375号-1 (https://beian.miit.gov.cn/).',
  '公安备案号：沪公网安备31011202022649号 (https://beian.mps.gov.cn/#/query/webSearch).',
] as const;

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
  isVisible,
  onAimedControlChange,
}: LaboratoryDebugAccessScreenProps) {
  const camera = useThree((state) => state.camera);
  const aimedRef = useRef(false);
  const screenMeshRef = useRef<Mesh | null>(null);
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
              label: "资源版权与备案",
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

  useFrame(() => {
    const screenMesh = screenMeshRef.current;

    if (!isVisible || !screenMesh) {
      setAimed(false);
      return;
    }

    raycasterRef.current.setFromCamera(screenCenter, camera);
    setAimed(
      raycasterRef.current.intersectObject(screenMesh, false).length > 0,
    );
  });

  if (!isVisible) {
    return null;
  }

  const [screenWidth, screenHeight] = screenSize;

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
      <mesh ref={screenMeshRef} position={[0, 0, 0.018]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshBasicMaterial
          color="#f8fdff"
          opacity={0.96}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.67, 0.045]}>
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
        position={[0, 0.67, 0.076]}
      >
        版权与备案
      </Text>
      <Text
        anchorX="left"
        anchorY="middle"
        color="#335766"
        fontSize={0.049}
        lineHeight={0.98}
        maxWidth={screenWidth - 0.44}
        overflowWrap="break-word"
        position={[-screenWidth / 2 + 0.22, -0.16, 0.078]}
        textAlign="left"
      >
        {copyrightNoticeLines.join("\n\n")}
      </Text>
    </group>
  );
}
