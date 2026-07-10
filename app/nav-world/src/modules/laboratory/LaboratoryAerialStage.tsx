import { Text, useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { DoubleSide, Group, Mesh } from "three";
import {
  landmarkPositions,
  playerSpawn,
  type Vector3Tuple,
} from "../../world/sceneConfig";
import { staticAssetUrl } from "../../assets/staticAssetUrl";
import type {
  LaboratoryAccessSnapshot,
} from "../../adapters/laboratoryAuth";
import {
  LaboratoryLoginScreen,
  type AimedLaboratoryLoginControl,
} from "./LaboratoryLoginScreen";
import { LaboratoryWebRtcScreen } from "./LaboratoryWebRtcScreen";

const domeModelUrl = staticAssetUrl("./models/laboratory/dome.glb");
const floorModelUrl = staticAssetUrl("./models/laboratory/glass_floor.glb");
const teleporterModelUrl = staticAssetUrl("./models/laboratory/teleporter.glb");

const laboratoryShellScale = 6;
const teleporterScale = 1.95;
const teleporterAssetCenterX = 0.678755;
const teleporterAssetBottomY = -0.07887;
const domeAssetBottomY = -0.06077;
const floorTopY = 0.035 * laboratoryShellScale;
const domeBottomY = floorTopY - domeAssetBottomY * laboratoryShellScale;
const skyLaboratoryScreenPosition: Vector3Tuple = [-6, 3.45, 6];
const skyLaboratoryScreenSize = [8.4, 6] as const;
const skyLaboratoryVideoWidth = skyLaboratoryScreenSize[0] - 1.18;
const skyLaboratoryVideoHeight = skyLaboratoryVideoWidth * (9 / 16);
const skyLaboratoryVideoY = -0.34;
const coordinateGuideY = floorTopY + 0.075;
const coordinateTickMarks = [-4, -2, 2, 4] as const;
const groundLoginScreenDistance = 4.35;
const groundLoginScreenY = 3.02;

interface LaboratoryAerialStageProps {
  laboratoryAccess: LaboratoryAccessSnapshot;
  isLoginScreenVisible: boolean;
  onAimedLoginControlChange: (
    control: AimedLaboratoryLoginControl | null,
  ) => void;
  onLoginInputActiveChange: (isActive: boolean) => void;
  onLoginScreenClose: () => void;
  onLoginSubmit: (
    username: string,
    password: string,
  ) => Promise<LaboratoryAccessSnapshot>;
}

function getYawForLocalPositiveXToFace(from: Vector3Tuple, to: Vector3Tuple) {
  return Math.atan2(from[2] - to[2], to[0] - from[0]);
}

function getYawForLocalPositiveZToFace(from: Vector3Tuple, to: Vector3Tuple) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

const skyLaboratoryScreenRotation: Vector3Tuple = [
  0,
  getYawForLocalPositiveZToFace(skyLaboratoryScreenPosition, [
    0,
    skyLaboratoryScreenPosition[1],
    0,
  ]),
  0,
];

function getGroundLoginScreenPosition(): Vector3Tuple {
  const [groundTeleporterX, , groundTeleporterZ] =
    landmarkPositions.laboratoryGroundTeleporter;
  const angleToSpawn = Math.atan2(
    playerSpawn.position[2] - groundTeleporterZ,
    playerSpawn.position[0] - groundTeleporterX,
  );

  return [
    Math.cos(angleToSpawn) * groundLoginScreenDistance,
    groundLoginScreenY,
    Math.sin(angleToSpawn) * groundLoginScreenDistance,
  ];
}

const groundLoginScreenPosition = getGroundLoginScreenPosition();
const groundLoginScreenRotation: Vector3Tuple = [
  0,
  getYawForLocalPositiveZToFace(groundLoginScreenPosition, [
    0,
    groundLoginScreenPosition[1],
    0,
  ]),
  0,
];

function cloneModelScene(scene: Group, shouldCastShadow: boolean) {
  const clonedScene = scene.clone(true);

  clonedScene.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = shouldCastShadow;
      object.receiveShadow = true;
    }
  });

  return clonedScene;
}

function LaboratoryModel({
  position = [0, 0, 0],
  scale = 1,
  shouldCastShadow = true,
  url,
}: {
  position?: Vector3Tuple;
  scale?: number;
  shouldCastShadow?: boolean;
  url: string;
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(
    () => cloneModelScene(gltf.scene, shouldCastShadow),
    [gltf.scene, shouldCastShadow],
  );

  return <primitive object={scene} position={position} scale={scale} />;
}

function TeleporterModel({
  facingFromWorldPosition,
  position,
}: {
  facingFromWorldPosition: Vector3Tuple;
  position: Vector3Tuple;
}) {
  const yaw = getYawForLocalPositiveXToFace(
    facingFromWorldPosition,
    playerSpawn.position,
  );

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <LaboratoryModel
        position={[-teleporterAssetCenterX * teleporterScale, 0, 0]}
        scale={teleporterScale}
        url={teleporterModelUrl}
      />
    </group>
  );
}

function SkyLaboratoryScreen({
  laboratoryAccess,
}: {
  laboratoryAccess: LaboratoryAccessSnapshot;
}) {
  const [screenWidth, screenHeight] = skyLaboratoryScreenSize;
  const videoTopY = skyLaboratoryVideoY + skyLaboratoryVideoHeight / 2;
  const authorizationKey =
    laboratoryAccess.status === "ready"
      ? `${laboratoryAccess.status}:${laboratoryAccess.user?.id ?? "user"}`
      : laboratoryAccess.status;

  return (
    <group
      position={skyLaboratoryScreenPosition}
      rotation={skyLaboratoryScreenRotation}
    >
      <mesh castShadow receiveShadow position={[0, 0, -0.08]}>
        <boxGeometry args={[screenWidth + 0.42, screenHeight + 0.42, 0.18]} />
        <meshStandardMaterial
          color="#d9edf5"
          emissive="#d7f5ff"
          emissiveIntensity={0.18}
          metalness={0.22}
          roughness={0.42}
        />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshStandardMaterial
          color="#f4fbff"
          emissive="#f1fbff"
          emissiveIntensity={0.2}
          metalness={0.08}
          opacity={0.98}
          roughness={0.36}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, screenHeight / 2 - 0.38, 0.046]}>
        <planeGeometry args={[screenWidth - 0.42, 0.56]} />
        <meshBasicMaterial
          color="#d7f0fb"
          opacity={0.98}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#1a5670"
        fontSize={0.34}
        maxWidth={screenWidth - 0.8}
        position={[0, screenHeight / 2 - 0.39, 0.09]}
      >
        天空实验室
      </Text>
      <mesh position={[0, -0.22, 0.052]}>
        <planeGeometry args={[screenWidth - 0.86, screenHeight - 1.32]} />
        <meshBasicMaterial
          color="#eef8fc"
          opacity={0.96}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <LaboratoryWebRtcScreen
        authorizationKey={authorizationKey}
        height={skyLaboratoryVideoHeight}
        isAuthorized={laboratoryAccess.status === "ready"}
        position={[0, skyLaboratoryVideoY, 0.063]}
        width={skyLaboratoryVideoWidth}
      />
      <mesh position={[0, videoTopY + 0.12, 0.072]}>
        <boxGeometry args={[screenWidth - 1.3, 0.035, 0.018]} />
        <meshBasicMaterial color="#62b8d5" opacity={0.72} transparent />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#266f8c"
        fontSize={0.24}
        maxWidth={screenWidth - 1.2}
        position={[0, videoTopY + 0.34, 0.096]}
      >
        链接外部世界
      </Text>
      <mesh position={[-screenWidth / 2 + 0.2, 0, 0.07]}>
        <boxGeometry args={[0.035, screenHeight - 0.78, 0.018]} />
        <meshBasicMaterial color="#62b8d5" opacity={0.5} transparent />
      </mesh>
      <mesh position={[screenWidth / 2 - 0.2, 0, 0.07]}>
        <boxGeometry args={[0.035, screenHeight - 0.78, 0.018]} />
        <meshBasicMaterial color="#62b8d5" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}

function FloorCoordinateLabel({
  children,
  position,
}: {
  children: string;
  position: Vector3Tuple;
}) {
  return (
    <Text
      anchorX="center"
      anchorY="middle"
      color="#dff8ff"
      fontSize={0.24}
      maxWidth={2.4}
      outlineColor="#063445"
      outlineWidth={0.012}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      {children}
    </Text>
  );
}

function LaboratoryCoordinateGuide() {
  return (
    <group>
      <mesh position={[0, coordinateGuideY, 0]}>
        <boxGeometry args={[10, 0.024, 0.05]} />
        <meshBasicMaterial color="#79e5ff" opacity={0.76} transparent />
      </mesh>
      <mesh position={[0, coordinateGuideY + 0.004, 0]}>
        <boxGeometry args={[0.05, 0.024, 10]} />
        <meshBasicMaterial color="#ffe38a" opacity={0.76} transparent />
      </mesh>
      {coordinateTickMarks.map((value) => (
        <group key={`tick-x-${value}`}>
          <mesh position={[value, coordinateGuideY + 0.008, 0]}>
            <boxGeometry args={[0.045, 0.026, 0.48]} />
            <meshBasicMaterial color="#79e5ff" opacity={0.62} transparent />
          </mesh>
          <FloorCoordinateLabel position={[value, coordinateGuideY + 0.035, 0.62]}>
            {`X ${value}`}
          </FloorCoordinateLabel>
        </group>
      ))}
      {coordinateTickMarks.map((value) => (
        <group key={`tick-z-${value}`}>
          <mesh position={[0, coordinateGuideY + 0.012, value]}>
            <boxGeometry args={[0.48, 0.026, 0.045]} />
            <meshBasicMaterial color="#ffe38a" opacity={0.62} transparent />
          </mesh>
          <FloorCoordinateLabel position={[0.72, coordinateGuideY + 0.039, value]}>
            {`Z ${value}`}
          </FloorCoordinateLabel>
        </group>
      ))}
      <FloorCoordinateLabel position={[0, coordinateGuideY + 0.06, -0.72]}>
        中心 X0 Z0
      </FloorCoordinateLabel>
      <FloorCoordinateLabel position={[5.25, coordinateGuideY + 0.04, 0]}>
        +X
      </FloorCoordinateLabel>
      <FloorCoordinateLabel position={[-5.25, coordinateGuideY + 0.04, 0]}>
        -X
      </FloorCoordinateLabel>
      <FloorCoordinateLabel position={[0, coordinateGuideY + 0.04, 5.25]}>
        +Z
      </FloorCoordinateLabel>
      <FloorCoordinateLabel position={[0, coordinateGuideY + 0.04, -5.25]}>
        -Z
      </FloorCoordinateLabel>
    </group>
  );
}

function AerialLaboratoryBeacon({
  laboratoryAccess,
}: {
  laboratoryAccess: LaboratoryAccessSnapshot;
}) {
  const [x, y, z] = landmarkPositions.laboratory;

  return (
    <group position={[x, y, z]}>
      <pointLight color="#65dfff" intensity={16} distance={48} position={[0, 7.2, 0]} />
      <LaboratoryModel
        scale={laboratoryShellScale}
        shouldCastShadow={false}
        url={floorModelUrl}
      />
      <LaboratoryModel
        position={[0, domeBottomY, 0]}
        scale={laboratoryShellScale}
        url={domeModelUrl}
      />
      <TeleporterModel
        facingFromWorldPosition={[
          x,
          y + floorTopY - teleporterAssetBottomY * teleporterScale,
          z,
        ]}
        position={[
          0,
          floorTopY - teleporterAssetBottomY * teleporterScale,
          0,
        ]}
      />
      <SkyLaboratoryScreen laboratoryAccess={laboratoryAccess} />
      <LaboratoryCoordinateGuide />
    </group>
  );
}

function GroundTeleporter({
  laboratoryAccess,
  isLoginScreenVisible,
  onAimedLoginControlChange,
  onLoginInputActiveChange,
  onLoginScreenClose,
  onLoginSubmit,
}: LaboratoryAerialStageProps) {
  const [x, y, z] = landmarkPositions.laboratoryGroundTeleporter;

  return (
    <group position={[x, y, z]}>
      <pointLight color="#60e6ff" intensity={13} distance={22} position={[0, 2.7, 0]} />
      <TeleporterModel
        facingFromWorldPosition={[
          x,
          y - teleporterAssetBottomY * teleporterScale,
          z,
        ]}
        position={[
          0,
          -teleporterAssetBottomY * teleporterScale,
          0,
        ]}
      />
      <LaboratoryLoginScreen
        access={laboratoryAccess}
        isVisible={isLoginScreenVisible}
        onAimedControlChange={onAimedLoginControlChange}
        onInputActiveChange={onLoginInputActiveChange}
        onRequestClose={onLoginScreenClose}
        onSubmitCredentials={onLoginSubmit}
        position={groundLoginScreenPosition}
        rotation={groundLoginScreenRotation}
      />
    </group>
  );
}

export function LaboratoryAerialStage({
  laboratoryAccess,
  isLoginScreenVisible,
  onAimedLoginControlChange,
  onLoginInputActiveChange,
  onLoginScreenClose,
  onLoginSubmit,
}: LaboratoryAerialStageProps) {
  return (
    <>
      <GroundTeleporter
        laboratoryAccess={laboratoryAccess}
        isLoginScreenVisible={isLoginScreenVisible}
        onAimedLoginControlChange={onAimedLoginControlChange}
        onLoginInputActiveChange={onLoginInputActiveChange}
        onLoginScreenClose={onLoginScreenClose}
        onLoginSubmit={onLoginSubmit}
      />
      <AerialLaboratoryBeacon laboratoryAccess={laboratoryAccess} />
    </>
  );
}
