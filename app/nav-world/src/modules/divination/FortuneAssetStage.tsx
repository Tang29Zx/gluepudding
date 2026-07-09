import { Billboard, Text, useGLTF } from "@react-three/drei";
import {
  Component,
  Suspense,
  useMemo,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { DoubleSide, Mesh } from "three";
import {
  landmarkPositions,
} from "../../world/sceneConfig";
import {
  fortuneAssetLoadingConfig,
  fortuneModelAssets,
  type FortuneModelAsset,
} from "./fortuneModelAssets";
import { ZodiacWheel } from "./ZodiacWheel";

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
const coordinateTicks = [-8, -6, -4, -2, 2, 4, 6, 8] as const;
const blankScreenDefinitions = [
  {
    id: "tarot",
    position: [0, 2.0, 5.85],
    rotation: [0, Math.PI, 0],
  },
  {
    id: "iching",
    position: [7.45, 2.0, 0],
    rotation: [0, -Math.PI / 2, 0],
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

function BlankContentScreens() {
  return (
    <>
      {blankScreenDefinitions.map((screen) => (
        <group
          key={screen.id}
          position={screen.position}
          rotation={screen.rotation}
        >
          <mesh receiveShadow>
            <planeGeometry args={[2.45, 1.55]} />
            <meshBasicMaterial
              color="#fbfbff"
              side={DoubleSide}
              transparent
              opacity={0.9}
            />
          </mesh>
          <mesh position={[0, 0, 0.018]}>
            <boxGeometry args={[2.55, 1.65, 0.035]} />
            <meshBasicMaterial
              color="#e8dcff"
              transparent
              opacity={0.32}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function CoordinateLabel({
  children,
  color,
  position,
}: {
  children: string;
  color: string;
  position: [number, number, number];
}) {
  return (
    <Billboard position={position}>
      <Text
        anchorX="center"
        anchorY="middle"
        color={color}
        fontSize={0.28}
        outlineColor="#f8fbff"
        outlineWidth={0.018}
      >
        {children}
      </Text>
    </Billboard>
  );
}

function FortuneCoordinateGuide() {
  const guideY = fortuneAssetLoadingConfig.floorSurfaceOffset + 0.18;
  const labelY = guideY + 0.42;

  return (
    <group>
      <mesh position={[0, guideY, 0]}>
        <boxGeometry args={[17.2, 0.035, 0.035]} />
        <meshBasicMaterial color="#f04444" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, guideY, 0]}>
        <boxGeometry args={[0.035, 0.035, 17.2]} />
        <meshBasicMaterial color="#2d7dff" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, guideY + 0.025, 0]}>
        <sphereGeometry args={[0.16, 18, 12]} />
        <meshBasicMaterial color="#f8fbff" />
      </mesh>

      {coordinateTicks.map((tick) => (
        <group key={`x-${tick}`}>
          <mesh position={[tick, guideY + 0.02, 0]}>
            <boxGeometry args={[0.035, 0.05, 0.42]} />
            <meshBasicMaterial color="#f04444" />
          </mesh>
          <CoordinateLabel
            color="#c72525"
            position={[tick, labelY, tick % 4 === 0 ? 0.62 : -0.62]}
          >
            {`X ${tick}`}
          </CoordinateLabel>
        </group>
      ))}

      {coordinateTicks.map((tick) => (
        <group key={`z-${tick}`}>
          <mesh position={[0, guideY + 0.02, tick]}>
            <boxGeometry args={[0.42, 0.05, 0.035]} />
            <meshBasicMaterial color="#2d7dff" />
          </mesh>
          <CoordinateLabel
            color="#1d5fd0"
            position={[tick % 4 === 0 ? 0.72 : -0.72, labelY, tick]}
          >
            {`Z ${tick}`}
          </CoordinateLabel>
        </group>
      ))}

      <CoordinateLabel color="#ffffff" position={[0, labelY + 0.18, 0]}>
        中心 0,0
      </CoordinateLabel>
      <CoordinateLabel color="#f04444" position={[8.75, labelY + 0.1, 0]}>
        X+
      </CoordinateLabel>
      <CoordinateLabel color="#f04444" position={[-8.75, labelY + 0.1, 0]}>
        X-
      </CoordinateLabel>
      <CoordinateLabel color="#2d7dff" position={[0, labelY + 0.1, 8.75]}>
        Z+
      </CoordinateLabel>
      <CoordinateLabel color="#2d7dff" position={[0, labelY + 0.1, -8.75]}>
        Z-
      </CoordinateLabel>
    </group>
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
  return (
    <>
      {fortuneModelAssets.interiorAssets.map((asset) => (
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
      <FortuneAssetBoundary fallback={<ShellFallback />} label="Fortune shell">
        <Suspense fallback={null}>
          <ShellModels />
        </Suspense>
      </FortuneAssetBoundary>
      {shouldLoadInterior ? (
        <FortuneAssetBoundary fallback={<InteriorFallback />} label="Fortune interior">
          <Suspense fallback={null}>
            <InteriorModels />
            <BlankContentScreens />
            <ZodiacWheel />
          </Suspense>
        </FortuneAssetBoundary>
      ) : null}
      {shouldLoadInterior ? <FortuneCoordinateGuide /> : null}
    </group>
  );
}
