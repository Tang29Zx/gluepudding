import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type MutableRefObject,
} from "react";
import {
  InteractionSystem,
  type InteractionTargetId,
} from "./InteractionSystem";
import {
  IslandTerrain,
  WorldTerrainErrorBoundary,
} from "./IslandTerrain";
import { IslandScenery, type SakuraLevel } from "./IslandScenery";
import {
  TrackedModelGate,
  type ModelDownloadProgressHandler,
} from "../assets/TrackedModelGate";
import { gomokuAssets } from "../assets/worldAssetManifest";
import { GamePortal } from "../modules/GamePortal";
import { FortuneAssetStage } from "../modules/divination/FortuneAssetStage";
import {
  GomokuBoardActivation,
  GomokuWorldBoard,
} from "../modules/gomoku/GomokuWorldBoard";
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
import { worldColors, worldScale, worldTerrain } from "./sceneConfig";
import { WorldComposition } from "./WorldComposition";
import { WorldAtmosphere } from "./WorldAtmosphere";

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
  sakuraPreloadLevel: SakuraLevel;
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
  onCriticalVisualReadyChange: (isReady: boolean) => void;
  onFortuneInteriorReadyChange: (isReady: boolean) => void;
  onModelDownloadProgressChange: ModelDownloadProgressHandler;
  onSakuraDeferredLevelReady: (
    level: Exclude<SakuraLevel, "low">,
  ) => void;
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
  onCriticalVisualReadyChange,
  onFortuneInteriorReadyChange,
  onModelDownloadProgressChange,
  onSakuraDeferredLevelReady,
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
  sakuraPreloadLevel,
  selectedTargetId,
  shouldLoadFortuneInterior,
  shouldLoadFortuneShell,
}: WorldSceneProps) {
  const [isFortuneShellReady, setIsFortuneShellReady] = useState(false);
  const [isLaboratoryReady, setIsLaboratoryReady] = useState(false);
  const [isSceneryReady, setIsSceneryReady] = useState(false);
  const isOutsideWorldVisible = !isPlayerInsideFortuneRoom;
  const sceneBackground = isPlayerInsideFortuneRoom ? "#160f28" : worldColors.sky;
  const sceneFog: [string, number, number] = isPlayerInsideFortuneRoom
    ? ["#160f28", 9, 34]
    : ["#b8c8c6", 54, 132];
  const terrainModelUrl = worldTerrain.modelUrl;
  const handleTerrainError = useCallback(() => {
    onTerrainSamplerChange(null);
    onTerrainReadyChange(false);
  }, [onTerrainReadyChange, onTerrainSamplerChange]);

  useEffect(() => {
    onCriticalVisualReadyChange(
      isFortuneShellReady && isLaboratoryReady && isSceneryReady,
    );
  }, [
    isFortuneShellReady,
    isLaboratoryReady,
    isSceneryReady,
    onCriticalVisualReadyChange,
  ]);

  return (
    <>
      <color attach="background" args={[sceneBackground]} />
      <fog attach="fog" args={sceneFog} />
      {isOutsideWorldVisible ? <WorldAtmosphere /> : null}
      <ambientLight intensity={0.17} />
      <hemisphereLight args={["#c8e0e5", "#4c5848", 0.56]} />
      <directionalLight
        castShadow
        color="#ffd5a4"
        intensity={3.05}
        position={[-34, 30, 26]}
        shadow-bias={-0.00012}
        shadow-camera-bottom={-48}
        shadow-camera-far={110}
        shadow-camera-left={-48}
        shadow-camera-near={0.5}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-mapSize={[2048, 2048]}
        shadow-normalBias={0.055}
      />
      <directionalLight
        color="#9fc9dc"
        intensity={0.48}
        position={[24, 18, -34]}
      />

      <WorldTerrainErrorBoundary
        fallback={isOutsideWorldVisible ? <FallbackGround /> : null}
        onError={handleTerrainError}
        resetKey={terrainModelUrl}
      >
        <Suspense fallback={isOutsideWorldVisible ? <FallbackGround /> : null}>
          <IslandTerrain
            isVisible={isOutsideWorldVisible}
            modelUrl={terrainModelUrl}
            onTerrainReadyChange={onTerrainReadyChange}
            onTerrainSamplerChange={onTerrainSamplerChange}
          />
          <IslandScenery
            isVisible={isOutsideWorldVisible}
            onDeferredLevelReady={onSakuraDeferredLevelReady}
            onModelDownloadProgressChange={onModelDownloadProgressChange}
            onReadyChange={setIsSceneryReady}
            player={player}
            requestedLevel={sakuraPreloadLevel}
          />
        </Suspense>
      </WorldTerrainErrorBoundary>

      <WorldComposition
        isVisible={isOutsideWorldVisible}
        terrainSamplerRef={placementTerrainSamplerRef}
      />

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
        onShellReadyChange={setIsFortuneShellReady}
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
              onReadyChange={setIsLaboratoryReady}
              player={player}
            />
          </Suspense>
          {gomokuPlacement ? null : (
            <GomokuBoardActivation
              onHudMessageChange={onGomokuHudMessageChange}
              onPlacementChange={onGomokuPlacementChange}
              placementTerrainSamplerRef={placementTerrainSamplerRef}
              player={player}
            />
          )}
          {gomokuPlacement ? (
            <TrackedModelGate
              assets={gomokuAssets}
              groupLabel="五子棋模型"
              onProgressChange={onModelDownloadProgressChange}
              priority={50}
              taskId="gomoku"
            >
              <GomokuWorldBoard
                onAimedTargetChange={onAimedGomokuTargetChange}
                onHudMessageChange={onGomokuHudMessageChange}
                onPlacementChange={onGomokuPlacementChange}
                placement={gomokuPlacement}
                placementTerrainSamplerRef={placementTerrainSamplerRef}
                player={player}
              />
            </TrackedModelGate>
          ) : null}
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
