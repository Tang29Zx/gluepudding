import { useGLTF } from "@react-three/drei";
import {
  Component,
  Suspense,
  useMemo,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Mesh } from "three";
import {
  landmarkPositions,
} from "../../world/sceneConfig";
import {
  fortuneAssetLoadingConfig,
  fortuneModelAssets,
  type FortuneModelAsset,
} from "./fortuneModelAssets";
import { ZodiacWheel } from "./ZodiacWheel";
import { TarotTable } from "./TarotTable";
import { IchingDesk } from "./IchingDesk";
import { IchingHexagram } from "./IchingHexagram";

interface FortuneAssetStageProps {
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

const tentDoorFacingSpawnYaw = -2.47;

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

function ShellModels() {
  return (
    <>
      {fortuneModelAssets.shellAssets.map((asset) => (
        <FortuneModel asset={asset} key={asset.id} />
      ))}
    </>
  );
}

function InteriorModels() {
  const excludeIds = new Set(["iching-lot-cylinder", "iching-coin", "iching-bamboo-slips", "iching-yang-line", "tarot-crystal-ball"]);
  return (
    <>
      {fortuneModelAssets.interiorAssets
        .filter((a) => !excludeIds.has(a.id))
        .map((asset) => (
          <FortuneModel asset={asset} key={asset.id} />
        ))}
    </>
  );
}

export function FortuneAssetStage({
  shouldLoadInterior,
  shouldLoadShell,
}: FortuneAssetStageProps) {
  const [anchorX, anchorY, anchorZ] = landmarkPositions.divinationHouse;
  const stagePosition = [
    anchorX + fortuneAssetLoadingConfig.shellAnchorOffset[0],
    anchorY + fortuneAssetLoadingConfig.shellAnchorOffset[1],
    anchorZ + fortuneAssetLoadingConfig.shellAnchorOffset[2],
  ] as const;

  if (!shouldLoadShell) {
    return null;
  }

  return (
    <group position={stagePosition} rotation={[0, tentDoorFacingSpawnYaw, 0]}>
      <StageFloor />
      <FortuneMoodLights />
      <FortuneAssetBoundary fallback={<ShellFallback />} label="Fortune shell">
        <Suspense fallback={null}>
          <ShellModels />
        </Suspense>
      </FortuneAssetBoundary>
      {shouldLoadInterior ? (
        <FortuneAssetBoundary fallback={<InteriorFallback />} label="Fortune interior">
          <Suspense fallback={null}>
            <InteriorModels />
            <ZodiacWheel />
            <TarotTable />
            <IchingDesk />
            <IchingHexagram />
          </Suspense>
        </FortuneAssetBoundary>
      ) : null}
    </group>
  );
}
