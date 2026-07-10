import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
} from "three";
import {
  fortuneRoomConfig,
  getFortuneStagePosition,
  type FortuneRoomState,
} from "../../world/fortuneRoomConfig";
import { useFortuneAiAuth } from "../../auth/FortuneAiAuthContext";
import { LaboratoryLoginScreen } from "../laboratory/LaboratoryLoginScreen";
import {
  fortuneAssetLoadingConfig,
  fortuneModelAssets,
  type FortuneModelAsset,
} from "./fortuneModelAssets";
import { ZodiacWheel } from "./ZodiacWheel";
import { TarotTable } from "./TarotTable";
import { IchingDesk } from "./IchingDesk";
import { IchingHexagram } from "./IchingHexagram";
import type { LotResult } from "./ichingLots";

interface FortuneAssetStageProps {
  isInteriorVisible: boolean;
  isPlayerInsideFortuneRoom: boolean;
  mistPhase: FortuneRoomState;
  onInteriorReadyChange: (isReady: boolean) => void;
  onShellReadyChange: (isReady: boolean) => void;
  shouldLoadInterior: boolean;
  shouldLoadShell: boolean;
}

interface FortuneAssetBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  label: string;
}

interface FortuneAssetBoundaryState {
  hasError: boolean;
}

const mistLayerConfigs = [
  {
    color: "#1a0d2c",
    depthWrite: true,
    height: 5.2,
    opacity: 1,
    phase: 0.1,
    width: 5.1,
    x: 0,
    z: 0.03,
  },
  {
    color: "#5f438d",
    depthWrite: false,
    height: 4.95,
    opacity: 0.62,
    phase: 1.4,
    width: 4.35,
    x: -0.18,
    z: -0.08,
  },
  {
    color: "#b8a8d9",
    depthWrite: false,
    height: 3.85,
    opacity: 0.44,
    phase: 2.6,
    width: 3.3,
    x: 0.24,
    z: -0.16,
  },
] as const;

class FortuneAssetBoundary extends Component<
  FortuneAssetBoundaryProps,
  FortuneAssetBoundaryState
> {
  state: FortuneAssetBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FortuneAssetBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.warn(`${this.props.label} failed to render.`, error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function FortuneModel({ asset }: { asset: FortuneModelAsset }) {
  const gltf = useGLTF(asset.url);
  const scene = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);

    clonedScene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return clonedScene;
  }, [gltf.scene]);

  return (
    <primitive
      object={scene}
      position={asset.position}
      rotation={asset.rotation}
      scale={asset.scale}
    />
  );
}

function OptionalFortuneModel({ asset }: { asset: FortuneModelAsset }) {
  return (
    <FortuneAssetBoundary fallback={null} label={`Fortune model ${asset.id}`}>
      <FortuneModel asset={asset} />
    </FortuneAssetBoundary>
  );
}

function OptionalFortuneFeature({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <FortuneAssetBoundary fallback={null} label={label}>
      {children}
    </FortuneAssetBoundary>
  );
}

function ShellFallback() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 1.85, 0]}>
        <coneGeometry args={[4.3, 3.7, 8]} />
        <meshStandardMaterial color="#7c6fd3" roughness={0.78} />
      </mesh>
      <mesh receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[4.6, 4.9, 0.16, 18]} />
        <meshStandardMaterial color="#e8dcff" roughness={0.86} />
      </mesh>
    </group>
  );
}

function StageFloor() {
  const floorHeight = 0.24;

  return (
    <mesh
      receiveShadow
      position={[
        0,
        fortuneAssetLoadingConfig.floorSurfaceOffset - floorHeight / 2,
        0,
      ]}
    >
      <cylinderGeometry
        args={[
          fortuneAssetLoadingConfig.floorRadius,
          fortuneAssetLoadingConfig.floorRadius,
          floorHeight,
          128,
        ]}
      />
      <meshStandardMaterial color="#5f5d82" roughness={0.9} />
    </mesh>
  );
}

function InteriorFallback() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.7, 0.12]}>
        <cylinderGeometry args={[1.65, 1.65, 1.4, 24]} />
        <meshStandardMaterial color="#795b8f" roughness={0.72} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 2.9, 64]} />
        <meshBasicMaterial color="#d8c9ff" transparent opacity={0.68} />
      </mesh>
      <mesh castShadow position={[-4.15, 0.82, -0.72]}>
        <sphereGeometry args={[1.2, 24, 16]} />
        <meshStandardMaterial color="#a99bea" emissive="#5d4db6" emissiveIntensity={0.22} />
      </mesh>
      <mesh castShadow position={[4.2, 0.78, -0.62]}>
        <boxGeometry args={[2.3, 1.15, 1.55]} />
        <meshStandardMaterial color="#c5a36d" roughness={0.8} />
      </mesh>
    </group>
  );
}

function FortuneMoodLights() {
  return (
    <>
      <pointLight
        color="#ffd6a6"
        decay={2}
        distance={11}
        intensity={1.45}
        position={[0, 2.65, 4.15]}
      />
      <pointLight
        color="#9d83ff"
        decay={2}
        distance={12}
        intensity={1.05}
        position={[0, 3.1, -0.7]}
      />
      <pointLight
        color="#82d8ff"
        decay={2}
        distance={8}
        intensity={0.48}
        position={[-6.4, 1.7, 0.2]}
      />
    </>
  );
}

function createFortuneMistTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const baseGradient = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.52,
    canvas.width * 0.08,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.62,
  );
  baseGradient.addColorStop(0, "rgba(255, 255, 255, 0.96)");
  baseGradient.addColorStop(0.38, "rgba(235, 228, 255, 0.86)");
  baseGradient.addColorStop(0.72, "rgba(196, 176, 230, 0.34)");
  baseGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 54; index += 1) {
    const x = ((index * 73) % 512) + Math.sin(index * 1.7) * 28;
    const y = ((index * 131) % 768) + Math.cos(index * 1.3) * 34;
    const radius = 42 + ((index * 19) % 92);
    const alpha = 0.08 + ((index * 7) % 18) / 100;
    const cloudGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

    cloudGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    cloudGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = cloudGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;

  return texture;
}

function InteriorReadyMarker({
  onInteriorReadyChange,
}: {
  onInteriorReadyChange: (isReady: boolean) => void;
}) {
  useEffect(() => {
    onInteriorReadyChange(true);

    return () => {
      onInteriorReadyChange(false);
    };
  }, [onInteriorReadyChange]);

  return null;
}

function FortuneDoorMist({
  isPlayerInsideFortuneRoom,
  mistPhase,
}: {
  isPlayerInsideFortuneRoom: boolean;
  mistPhase: FortuneRoomState;
}) {
  const layerRefs = useRef<Array<Mesh | null>>([]);
  const mistTexture = useMemo(createFortuneMistTexture, []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const transitionBoost =
      mistPhase === "entering" || mistPhase === "exiting" ? 0.08 : 0;
    const sideBoost = isPlayerInsideFortuneRoom ? 0.05 : 0.13;

    layerRefs.current.forEach((mesh, index) => {
      if (!mesh) {
        return;
      }

      const layer = mistLayerConfigs[index];
      const material = mesh.material as MeshBasicMaterial;
      const drift = Math.sin(elapsed * 0.55 + layer.phase) * 0.18;
      const pulse = (Math.sin(elapsed * 0.9 + layer.phase) + 1) * 0.035;

      mesh.position.x = layer.x + drift;
      mesh.position.y =
        fortuneRoomConfig.roomFloorOffset + layer.height / 2 +
        Math.sin(elapsed * 0.42 + layer.phase) * 0.08;
      mesh.scale.x = 1 + Math.sin(elapsed * 0.35 + layer.phase) * 0.035;
      mesh.scale.y = 1 + Math.cos(elapsed * 0.31 + layer.phase) * 0.025;
      material.opacity = Math.min(
        0.96,
        layer.opacity + sideBoost + transitionBoost + pulse,
      );
    });
  });

  return (
    <group position={[0, 0, fortuneRoomConfig.doorLocalZ]}>
      <mesh
        position={[0, fortuneRoomConfig.roomFloorOffset + 2.35, 0.12]}
        renderOrder={7}
      >
        <planeGeometry args={[fortuneRoomConfig.doorMistWidth * 1.04, 5.15]} />
        <meshBasicMaterial
          color="#0b0414"
          depthWrite={true}
          side={DoubleSide}
        />
      </mesh>
      {mistLayerConfigs.map((layer, index) => (
        <mesh
          key={`${layer.phase}:${layer.width}`}
          position={[
            layer.x,
            fortuneRoomConfig.roomFloorOffset + layer.height / 2,
            layer.z,
          ]}
          ref={(mesh) => {
            layerRefs.current[index] = mesh;
          }}
          renderOrder={8}
        >
          <planeGeometry
            args={[
              fortuneRoomConfig.doorMistWidth * (layer.width / 3.35),
              fortuneRoomConfig.doorMistHeight * (layer.height / 4.25),
            ]}
          />
          <meshBasicMaterial
            alphaTest={layer.depthWrite ? 0 : 0.04}
            color={layer.color}
            depthWrite={layer.depthWrite}
            map={mistTexture}
            opacity={layer.opacity}
            side={DoubleSide}
            transparent={!layer.depthWrite}
          />
        </mesh>
      ))}
      <pointLight
        color="#cbb8ff"
        decay={2}
        distance={6}
        intensity={isPlayerInsideFortuneRoom ? 0.85 : 0.62}
        position={[0, 2.1, -0.25]}
      />
    </group>
  );
}

function FortuneInteriorPrivacyVeil() {
  return (
    <mesh
      position={[
        0,
        fortuneRoomConfig.roomFloorOffset + 2.45,
        0,
      ]}
      renderOrder={4}
    >
      <cylinderGeometry args={[6.82, 6.82, 4.9, 64, 1, false]} />
      <meshBasicMaterial
        color="#0d0617"
        depthWrite={true}
        side={DoubleSide}
      />
    </mesh>
  );
}

function ShellModels() {
  return (
    <>
      {fortuneModelAssets.shellAssets.map((asset) => (
        <FortuneModel asset={asset} key={asset.id} />
      ))}
    </>
  );
}

function FortuneShellReadyMarker({
  onReadyChange,
}: {
  onReadyChange: (isReady: boolean) => void;
}) {
  useEffect(() => {
    onReadyChange(true);

    return () => {
      onReadyChange(false);
    };
  }, [onReadyChange]);

  return null;
}

function InteriorModels() {
  const excludeIds = new Set(["iching-lot-cylinder", "iching-coin", "iching-bamboo-slips", "iching-yang-line", "tarot-crystal-ball"]);
  return (
    <>
      {fortuneModelAssets.interiorAssets
        .filter((a) => !excludeIds.has(a.id))
        .map((asset) => (
          <OptionalFortuneModel asset={asset} key={asset.id} />
        ))}
    </>
  );
}

function FortuneAiLoginScreen() {
  const {
    access,
    cancelLogin,
    isLoginVisible,
    setInputActive,
    submitCredentials,
  } = useFortuneAiAuth();

  return (
    <LaboratoryLoginScreen
      access={access}
      cancelLabel="暂不登录"
      description="登录后可使用塔罗与周易 AI 解读"
      isVisible={isLoginVisible}
      onAimedControlChange={() => {}}
      onCancel={cancelLogin}
      onInputActiveChange={setInputActive}
      onRequestClose={() => {}}
      onSubmitCredentials={submitCredentials}
      position={[0, 2.25, -2.15]}
      rotation={[0, Math.PI, 0]}
      showCancel
      successMessage="登录成功，正在继续 AI 解读"
      title="占卜屋 AI 登录"
    />
  );
}

export function FortuneAssetStage({
  isInteriorVisible,
  isPlayerInsideFortuneRoom,
  mistPhase,
  onInteriorReadyChange,
  onShellReadyChange,
  shouldLoadInterior,
  shouldLoadShell,
}: FortuneAssetStageProps) {
  const [ichingLotResult, setIchingLotResult] = useState<LotResult | null>(null);
  const stagePosition = getFortuneStagePosition();

  useEffect(() => {
    if (!shouldLoadInterior) {
      onInteriorReadyChange(false);
    }
  }, [onInteriorReadyChange, shouldLoadInterior]);

  useEffect(() => {
    if (!shouldLoadShell) {
      onShellReadyChange(false);
    }
  }, [onShellReadyChange, shouldLoadShell]);

  if (!shouldLoadShell) {
    return null;
  }

  return (
    <group position={stagePosition} rotation={[0, fortuneRoomConfig.shellYaw, 0]}>
      <StageFloor />
      {isInteriorVisible ? <FortuneMoodLights /> : null}
      <FortuneAssetBoundary fallback={<ShellFallback />} label="Fortune shell">
        <Suspense fallback={null}>
          <ShellModels />
          <FortuneShellReadyMarker onReadyChange={onShellReadyChange} />
        </Suspense>
      </FortuneAssetBoundary>
      <FortuneDoorMist
        isPlayerInsideFortuneRoom={isPlayerInsideFortuneRoom}
        mistPhase={mistPhase}
      />
      {isInteriorVisible ? <FortuneAiLoginScreen /> : null}
      {!isInteriorVisible ? <FortuneInteriorPrivacyVeil /> : null}
      {shouldLoadInterior ? (
        <FortuneAssetBoundary
          fallback={
            isInteriorVisible ? (
              <InteriorFallback />
            ) : null
          }
          label="Fortune interior"
        >
          <Suspense fallback={isInteriorVisible ? <InteriorFallback /> : null}>
            <group visible={isInteriorVisible}>
              <InteriorModels />
              <OptionalFortuneFeature label="Fortune zodiac wheel">
                <ZodiacWheel />
              </OptionalFortuneFeature>
              <OptionalFortuneFeature label="Fortune tarot table">
                <TarotTable />
              </OptionalFortuneFeature>
              <OptionalFortuneFeature label="Fortune iching desk">
                <IchingDesk onLotResult={setIchingLotResult} />
              </OptionalFortuneFeature>
              <OptionalFortuneFeature label="Fortune iching hexagram">
                <IchingHexagram
                  lotResult={ichingLotResult}
                  onLotResultClear={() => setIchingLotResult(null)}
                />
              </OptionalFortuneFeature>
            </group>
            <InteriorReadyMarker
              onInteriorReadyChange={onInteriorReadyChange}
            />
          </Suspense>
        </FortuneAssetBoundary>
      ) : null}
    </group>
  );
}
