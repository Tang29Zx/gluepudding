import { Suspense } from "react";
import {
  InteractionSystem,
  type InteractionTargetId,
} from "./InteractionSystem";
import {
  IslandTerrain,
  WorldTerrainErrorBoundary,
} from "./IslandTerrain";
import { FortuneAssetStage } from "../modules/divination/FortuneAssetStage";
import { WorldModulePanels } from "../modules/WorldModulePanels";
import type { AimedWorldModuleControl } from "../modules/types";
import type {
  WorldModuleId,
  WorldModuleStatus,
} from "../modules/types";
import type { PlayerControllerState } from "./PlayerController";
import type { TerrainSampler } from "./terrainSampler";
import { landmarkPositions, worldColors, worldScale } from "./sceneConfig";

function LaboratoryBlock() {
  const [x, y, z] = landmarkPositions.laboratory;

  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[15, 0.24, 10]} />
        <meshStandardMaterial color="#c6e7f8" roughness={0.84} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[12, 4, 7.5]} />
        <meshStandardMaterial color={worldColors.lab} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 3.05, 3.82]}>
        <boxGeometry args={[5.6, 1.85, 0.12]} />
        <meshStandardMaterial color="#1f3445" emissive="#234b70" emissiveIntensity={0.28} />
      </mesh>
      <mesh position={[-4.2, 1.15, 3.86]}>
        <boxGeometry args={[1.35, 2.3, 0.1]} />
        <meshStandardMaterial color="#31546c" roughness={0.62} />
      </mesh>
    </group>
  );
}

function GomokuArea() {
  const [x, y, z] = landmarkPositions.gomokuBoard;

  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[10, 0.16, 10]} />
        <meshStandardMaterial color={worldColors.gomoku} roughness={0.8} />
      </mesh>
      <mesh receiveShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[7.2, 0.12, 7.2]} />
        <meshStandardMaterial color="#fff3bd" roughness={0.82} />
      </mesh>
    </group>
  );
}

function SpawnScaleMarker() {
  return (
    <group position={[4.8, 1.58, 36]}>
      <mesh castShadow position={[0, 0.86, 0]}>
        <capsuleGeometry args={[0.32, 1.08, 12, 24]} />
        <meshStandardMaterial color={worldColors.player} roughness={0.62} />
      </mesh>
      <mesh castShadow position={[0, 1.84, 0]}>
        <sphereGeometry args={[0.24, 24, 16]} />
        <meshStandardMaterial color={worldColors.playerAccent} roughness={0.54} />
      </mesh>
    </group>
  );
}

function FallbackGround() {
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[worldScale.groundRadius, 128]} />
        <meshStandardMaterial color={worldColors.ground} roughness={0.96} />
      </mesh>
      <gridHelper
        args={[
          worldScale.gridSize,
          worldScale.gridDivisions,
          "#4e8fd6",
          worldColors.grid,
        ]}
        position={[0, 0.012, 0]}
      />
    </>
  );
}

function ReferenceLandmarks() {
  return (
    <group>
      <LaboratoryBlock />
      <GomokuArea />
      <SpawnScaleMarker />
    </group>
  );
}

interface WorldSceneProps {
  aimedModuleControl: AimedWorldModuleControl | null;
  moduleStatuses: Record<WorldModuleId, WorldModuleStatus>;
  player: PlayerControllerState;
  selectedTargetId: InteractionTargetId | null;
  shouldLoadFortuneInterior: boolean;
  shouldLoadFortuneShell: boolean;
  onActivateArea: (targetId: InteractionTargetId) => void;
  onAimedTargetChange: (targetId: InteractionTargetId | null) => void;
  onAimedModuleControlChange: (
    control: AimedWorldModuleControl | null,
  ) => void;
  onModuleStatusChange: (
    moduleId: WorldModuleId,
    status: WorldModuleStatus,
  ) => void;
  onNearestTargetChange: (targetId: InteractionTargetId | null) => void;
  onSelectObject: (targetId: InteractionTargetId) => void;
  onTerrainReadyChange: (isReady: boolean) => void;
  onTerrainSamplerChange: (sampler: TerrainSampler | null) => void;
}

export function WorldScene({
  aimedModuleControl,
  moduleStatuses,
  onActivateArea,
  onAimedModuleControlChange,
  onAimedTargetChange,
  onModuleStatusChange,
  onNearestTargetChange,
  onSelectObject,
  onTerrainReadyChange,
  onTerrainSamplerChange,
  player,
  selectedTargetId,
  shouldLoadFortuneInterior,
  shouldLoadFortuneShell,
}: WorldSceneProps) {
  return (
    <>
      <color attach="background" args={[worldColors.sky]} />
      <fog attach="fog" args={[worldColors.sky, 70, 150]} />
      <ambientLight intensity={0.28} />
      <hemisphereLight args={["#f5fbff", "#5e876d", 0.64]} />
      <directionalLight
        castShadow
        color="#fff0d8"
        intensity={3.1}
        position={[-8.5, 14, 7.2]}
        shadow-bias={-0.00015}
        shadow-camera-bottom={-48}
        shadow-camera-far={90}
        shadow-camera-left={-48}
        shadow-camera-near={0.5}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-mapSize={[2048, 2048]}
        shadow-normalBias={0.04}
      />

      <WorldTerrainErrorBoundary
        fallback={<FallbackGround />}
        onError={() => {
          onTerrainSamplerChange(null);
          onTerrainReadyChange(true);
        }}
      >
        <Suspense fallback={null}>
          <IslandTerrain
            onTerrainReadyChange={onTerrainReadyChange}
            onTerrainSamplerChange={onTerrainSamplerChange}
          />
        </Suspense>
      </WorldTerrainErrorBoundary>

      <ReferenceLandmarks />
      <FortuneAssetStage
        shouldLoadInterior={shouldLoadFortuneInterior}
        shouldLoadShell={shouldLoadFortuneShell}
      />
      <InteractionSystem
        isPanelOpen={false}
        isWorldControlAimed={Boolean(aimedModuleControl)}
        onActivateArea={onActivateArea}
        onAimedTargetChange={onAimedTargetChange}
        onNearestTargetChange={onNearestTargetChange}
        onSelectObject={onSelectObject}
        player={player}
        selectedTargetId={selectedTargetId}
      />
      <Suspense fallback={null}>
        <WorldModulePanels
          aimedModuleControl={aimedModuleControl}
          moduleStatuses={moduleStatuses}
          onAimedModuleControlChange={onAimedModuleControlChange}
          onModuleStatusChange={onModuleStatusChange}
        />
      </Suspense>
    </>
  );
}
