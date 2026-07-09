import { Suspense, type MutableRefObject } from "react";
import {
  InteractionSystem,
  type InteractionTargetId,
} from "./InteractionSystem";
import {
  IslandTerrain,
  WorldTerrainErrorBoundary,
} from "./IslandTerrain";
import { GamePortal } from "../modules/GamePortal";
import { FortuneAssetStage } from "../modules/divination/FortuneAssetStage";
import { GomokuWorldBoard } from "../modules/gomoku/GomokuWorldBoard";
import { LaboratoryAerialStage } from "../modules/laboratory/LaboratoryAerialStage";
import {
  LaboratoryDebugAccessScreen,
  type AimedLaboratoryDebugControl,
} from "../modules/laboratory/LaboratoryDebugAccessScreen";
import type {
  LaboratoryAccessSnapshot,
} from "../adapters/laboratoryAuth";
import type {
  AimedLaboratoryLoginControl,
} from "../modules/laboratory/LaboratoryLoginScreen";
import type {
  GomokuAimTarget,
  GomokuPlacement,
} from "../modules/gomoku/gomokuWorldTypes";
import { WorldModulePanels } from "../modules/WorldModulePanels";
import type { AimedWorldModuleControl } from "../modules/types";
import type {
  WorldModuleId,
  WorldModuleStatus,
} from "../modules/types";
import type { FortuneRoomState } from "./fortuneRoomConfig";
import type { PlayerControllerState } from "./PlayerController";
import type { TerrainSampler } from "./terrainSampler";
import { worldColors, worldScale } from "./sceneConfig";

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

interface WorldSceneProps {
  aimedLaboratoryDebugControl: AimedLaboratoryDebugControl | null;
  aimedLaboratoryLoginControl: AimedLaboratoryLoginControl | null;
  aimedModuleControl: AimedWorldModuleControl | null;
  aimedGomokuTarget: GomokuAimTarget | null;
  fortuneRoomState: FortuneRoomState;
  gomokuPlacement: GomokuPlacement | null;
  isFortuneRoomInteriorVisible: boolean;
  isLaboratoryDebugScreenVisible: boolean;
  isLaboratoryLoginInputActive: boolean;
  isLaboratoryLoginScreenVisible: boolean;
  isPlayerInsideFortuneRoom: boolean;
  laboratoryAccess: LaboratoryAccessSnapshot;
  moduleStatuses: Record<WorldModuleId, WorldModuleStatus>;
  placementTerrainSamplerRef: MutableRefObject<TerrainSampler | null>;
  player: PlayerControllerState;
  selectedTargetId: InteractionTargetId | null;
  shouldLoadFortuneInterior: boolean;
  shouldLoadFortuneShell: boolean;
  onActivateArea: (targetId: InteractionTargetId) => void;
  onAimedLaboratoryDebugControlChange: (
    control: AimedLaboratoryDebugControl | null,
  ) => void;
  onAimedGomokuTargetChange: (target: GomokuAimTarget | null) => void;
  onAimedLaboratoryLoginControlChange: (
    control: AimedLaboratoryLoginControl | null,
  ) => void;
  onAimedTargetChange: (targetId: InteractionTargetId | null) => void;
  onAimedModuleControlChange: (
    control: AimedWorldModuleControl | null,
  ) => void;
  onFortuneInteriorReadyChange: (isReady: boolean) => void;
  onGomokuHudMessageChange: (message: string | null) => void;
  onGomokuPlacementChange: (placement: GomokuPlacement | null) => void;
  onLaboratoryLoginInputActiveChange: (isActive: boolean) => void;
  onLaboratoryLoginScreenClose: () => void;
  onLaboratoryLoginSubmit: (
    username: string,
    password: string,
  ) => Promise<LaboratoryAccessSnapshot>;
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
  aimedLaboratoryDebugControl,
  aimedLaboratoryLoginControl,
  aimedGomokuTarget,
  aimedModuleControl,
  fortuneRoomState,
  gomokuPlacement,
  isFortuneRoomInteriorVisible,
  isLaboratoryDebugScreenVisible,
  isLaboratoryLoginInputActive,
  isLaboratoryLoginScreenVisible,
  isPlayerInsideFortuneRoom,
  laboratoryAccess,
  moduleStatuses,
  onActivateArea,
  onAimedLaboratoryDebugControlChange,
  onAimedGomokuTargetChange,
  onAimedLaboratoryLoginControlChange,
  onAimedModuleControlChange,
  onAimedTargetChange,
  onFortuneInteriorReadyChange,
  onGomokuHudMessageChange,
  onGomokuPlacementChange,
  onLaboratoryLoginInputActiveChange,
  onLaboratoryLoginScreenClose,
  onLaboratoryLoginSubmit,
  onModuleStatusChange,
  onNearestTargetChange,
  onSelectObject,
  onTerrainReadyChange,
  onTerrainSamplerChange,
  placementTerrainSamplerRef,
  player,
  selectedTargetId,
  shouldLoadFortuneInterior,
  shouldLoadFortuneShell,
}: WorldSceneProps) {
  const isOutsideWorldVisible = !isPlayerInsideFortuneRoom;
  const sceneBackground = isPlayerInsideFortuneRoom ? "#160f28" : worldColors.sky;
  const sceneFog: [string, number, number] = isPlayerInsideFortuneRoom
    ? ["#160f28", 9, 34]
    : [worldColors.sky, 70, 150];

  return (
    <>
      <color attach="background" args={[sceneBackground]} />
      <fog attach="fog" args={sceneFog} />
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
        fallback={isOutsideWorldVisible ? <FallbackGround /> : null}
        onError={() => {
          onTerrainSamplerChange(null);
          onTerrainReadyChange(true);
        }}
      >
        <Suspense fallback={null}>
          <IslandTerrain
            isVisible={isOutsideWorldVisible}
            onTerrainReadyChange={onTerrainReadyChange}
            onTerrainSamplerChange={onTerrainSamplerChange}
          />
        </Suspense>
      </WorldTerrainErrorBoundary>

      {isOutsideWorldVisible ? (
        <>
          <LaboratoryDebugAccessScreen
            isVisible={isLaboratoryDebugScreenVisible}
            onAimedControlChange={onAimedLaboratoryDebugControlChange}
          />
          <GamePortal />
        </>
      ) : null}
      <FortuneAssetStage
        isInteriorVisible={isFortuneRoomInteriorVisible}
        isPlayerInsideFortuneRoom={isPlayerInsideFortuneRoom}
        mistPhase={fortuneRoomState}
        onInteriorReadyChange={onFortuneInteriorReadyChange}
        shouldLoadInterior={shouldLoadFortuneInterior}
        shouldLoadShell={shouldLoadFortuneShell}
      />
      {isOutsideWorldVisible ? (
        <>
          <Suspense fallback={null}>
            <LaboratoryAerialStage
              laboratoryAccess={laboratoryAccess}
              isLoginScreenVisible={isLaboratoryLoginScreenVisible}
              onAimedLoginControlChange={onAimedLaboratoryLoginControlChange}
              onLoginInputActiveChange={onLaboratoryLoginInputActiveChange}
              onLoginScreenClose={onLaboratoryLoginScreenClose}
              onLoginSubmit={onLaboratoryLoginSubmit}
            />
          </Suspense>
          <Suspense fallback={null}>
            <GomokuWorldBoard
              onAimedTargetChange={onAimedGomokuTargetChange}
              onHudMessageChange={onGomokuHudMessageChange}
              onPlacementChange={onGomokuPlacementChange}
              placement={gomokuPlacement}
              placementTerrainSamplerRef={placementTerrainSamplerRef}
              player={player}
            />
          </Suspense>
          <InteractionSystem
            isPanelOpen={false}
            isWorldControlAimed={Boolean(
              aimedModuleControl ||
                aimedGomokuTarget ||
                aimedLaboratoryDebugControl ||
                aimedLaboratoryLoginControl ||
                isLaboratoryLoginInputActive,
            )}
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
      ) : null}
    </>
  );
}
