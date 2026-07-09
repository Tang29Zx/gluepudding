import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector3,
} from "three";
import { fortuneAssetLoadingConfig } from "../modules/divination/fortuneModelAssets";
import {
  createDefaultWorldModuleStatuses,
  getWorldModuleById,
  getWorldModuleIdByTargetId,
} from "../modules/moduleRegistry";
import type {
  AimedWorldModuleControl,
  WorldModuleId,
  WorldModuleStatus,
} from "../modules/types";
import {
  sampleGomokuSurface,
  type GomokuAimTarget,
  type GomokuPlacement,
} from "../modules/gomoku/gomokuWorldTypes";
import { CameraRig } from "./CameraRig";
import {
  getInteractionTargetById,
  type InteractionTargetId,
} from "./InteractionSystem";
import { usePlayerController } from "./PlayerController";
import type { TerrainSampler } from "./terrainSampler";
import { WorldScene } from "./WorldScene";
import {
  cameraConfig,
  landmarkPositions,
  worldColors,
} from "./sceneConfig";

interface WorldExperienceProps {
  onReady: () => void;
}

type ForcedFortuneAssetMode = "interior" | "shell" | null;

const fortuneFloorNormal = new Vector3(0, 1, 0);

interface WorldRuntimeProps {
  aimedGomokuTarget: GomokuAimTarget | null;
  aimedModuleControl: AimedWorldModuleControl | null;
  focusedModuleId: WorldModuleId | null;
  forcedFortuneAssetMode: ForcedFortuneAssetMode;
  gomokuPlacement: GomokuPlacement | null;
  moduleStatuses: Record<WorldModuleId, WorldModuleStatus>;
  onActivateArea: (targetId: InteractionTargetId) => void;
  onAimedGomokuTargetChange: (target: GomokuAimTarget | null) => void;
  onAimedModuleControlChange: (
    control: AimedWorldModuleControl | null,
  ) => void;
  onGomokuHudMessageChange: (message: string | null) => void;
  onGomokuPlacementChange: (placement: GomokuPlacement | null) => void;
  onAimedTargetChange: (targetId: InteractionTargetId | null) => void;
  onModuleStatusChange: (
    moduleId: WorldModuleId,
    status: WorldModuleStatus,
  ) => void;
  onNearestTargetChange: (targetId: InteractionTargetId | null) => void;
  onSelectObject: (targetId: InteractionTargetId) => void;
  onTerrainReadyChange: (isReady: boolean) => void;
  selectedTargetId: InteractionTargetId | null;
}

function WorldRuntime({
  aimedGomokuTarget,
  aimedModuleControl,
  focusedModuleId,
  forcedFortuneAssetMode,
  gomokuPlacement,
  moduleStatuses,
  onActivateArea,
  onAimedGomokuTargetChange,
  onAimedModuleControlChange,
  onAimedTargetChange,
  onGomokuHudMessageChange,
  onGomokuPlacementChange,
  onModuleStatusChange,
  onNearestTargetChange,
  onSelectObject,
  onTerrainReadyChange,
  selectedTargetId,
}: WorldRuntimeProps) {
  const [
    divinationHouseX,
    divinationHouseY,
    divinationHouseZ,
  ] = landmarkPositions.divinationHouse;
  const fortuneStageX =
    divinationHouseX + fortuneAssetLoadingConfig.shellAnchorOffset[0];
  const fortuneStageY =
    divinationHouseY + fortuneAssetLoadingConfig.shellAnchorOffset[1];
  const fortuneStageZ =
    divinationHouseZ + fortuneAssetLoadingConfig.shellAnchorOffset[2];
  const placementTerrainSamplerRef = useRef<TerrainSampler | null>(null);
  const terrainSamplerRef = useRef<TerrainSampler | null>(null);
  const [rawTerrainSampler, setRawTerrainSampler] =
    useState<TerrainSampler | null>(null);
  const placementTerrainSampler = useMemo<TerrainSampler | null>(() => {
    if (!rawTerrainSampler) {
      return null;
    }

    return {
      sampleGround(x, z) {
        const distanceToFortuneFloor = Math.hypot(
          x - fortuneStageX,
          z - fortuneStageZ,
        );

        if (distanceToFortuneFloor <= fortuneAssetLoadingConfig.floorRadius) {
          return {
            normal: fortuneFloorNormal,
            y: fortuneStageY + fortuneAssetLoadingConfig.floorSurfaceOffset,
          };
        }

        return rawTerrainSampler.sampleGround(x, z);
      },
    };
  }, [fortuneStageX, fortuneStageY, fortuneStageZ, rawTerrainSampler]);
  const worldTerrainSampler = useMemo<TerrainSampler | null>(() => {
    if (!placementTerrainSampler) {
      return null;
    }

    return {
      sampleGround(x, z) {
        const terrainSample = placementTerrainSampler.sampleGround(x, z);

        return (
          sampleGomokuSurface(gomokuPlacement, x, z, terrainSample) ??
          terrainSample
        );
      },
    };
  }, [gomokuPlacement, placementTerrainSampler]);

  useEffect(() => {
    placementTerrainSamplerRef.current = placementTerrainSampler;
    terrainSamplerRef.current = worldTerrainSampler;
  }, [placementTerrainSampler, worldTerrainSampler]);

  const setTerrainSampler = useCallback((sampler: TerrainSampler | null) => {
    setRawTerrainSampler(sampler);
  }, []);
  const player = usePlayerController({
    isMovementEnabled: true,
    terrainSamplerRef,
  });
  const [shouldLoadFortuneInteriorByDistance, setShouldLoadFortuneInteriorByDistance] =
    useState(false);
  const shouldLoadFortuneInteriorByDistanceRef = useRef(false);

  useFrame(() => {
    const distance = Math.hypot(
      player.position.current.x - fortuneStageX,
      player.position.current.z - fortuneStageZ,
    );
    const nextShouldLoadInterior =
      distance <= fortuneAssetLoadingConfig.interiorLoadRadius;

    if (
      shouldLoadFortuneInteriorByDistanceRef.current !== nextShouldLoadInterior
    ) {
      shouldLoadFortuneInteriorByDistanceRef.current = nextShouldLoadInterior;
      setShouldLoadFortuneInteriorByDistance(nextShouldLoadInterior);
    }
  });

  const shouldLoadFortuneShell = true;
  const shouldLoadFortuneInterior =
    forcedFortuneAssetMode === "interior" ||
      focusedModuleId === "divination" ||
      selectedTargetId === "divination-house" ||
      shouldLoadFortuneInteriorByDistance;

  return (
    <>
      <CameraRig player={player} />
      <WorldScene
        aimedGomokuTarget={aimedGomokuTarget}
        aimedModuleControl={aimedModuleControl}
        moduleStatuses={moduleStatuses}
        gomokuPlacement={gomokuPlacement}
        onTerrainReadyChange={onTerrainReadyChange}
        onTerrainSamplerChange={setTerrainSampler}
        onActivateArea={onActivateArea}
        onAimedGomokuTargetChange={onAimedGomokuTargetChange}
        onAimedModuleControlChange={onAimedModuleControlChange}
        onGomokuHudMessageChange={onGomokuHudMessageChange}
        onGomokuPlacementChange={onGomokuPlacementChange}
        onAimedTargetChange={onAimedTargetChange}
        onModuleStatusChange={onModuleStatusChange}
        onNearestTargetChange={onNearestTargetChange}
        onSelectObject={onSelectObject}
        placementTerrainSamplerRef={placementTerrainSamplerRef}
        player={player}
        selectedTargetId={selectedTargetId}
        shouldLoadFortuneInterior={shouldLoadFortuneInterior}
        shouldLoadFortuneShell={shouldLoadFortuneShell}
      />
    </>
  );
}

function getForcedFortuneAssetMode(): ForcedFortuneAssetMode {
  const assetMode = new URLSearchParams(window.location.search).get(
    "fortuneAssets",
  );

  if (assetMode === "shell" || assetMode === "interior") {
    return assetMode;
  }

  return null;
}

export function WorldExperience({ onReady }: WorldExperienceProps) {
  const [aimedModuleControl, setAimedModuleControl] =
    useState<AimedWorldModuleControl | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isTerrainReady, setIsTerrainReady] = useState(false);
  const [aimedTargetId, setAimedTargetId] =
    useState<InteractionTargetId | null>(null);
  const [focusedModuleId, setFocusedModuleId] =
    useState<WorldModuleId | null>(null);
  const [aimedGomokuTarget, setAimedGomokuTarget] =
    useState<GomokuAimTarget | null>(null);
  const [gomokuHudMessage, setGomokuHudMessage] =
    useState<string | null>(null);
  const [gomokuPlacement, setGomokuPlacement] =
    useState<GomokuPlacement | null>(null);
  const [moduleStatuses, setModuleStatuses] = useState(
    createDefaultWorldModuleStatuses,
  );
  const [nearestTargetId, setNearestTargetId] =
    useState<InteractionTargetId | null>(null);
  const [selectedTargetId, setSelectedTargetId] =
    useState<InteractionTargetId | null>(null);
  const [forcedFortuneAssetMode] =
    useState<ForcedFortuneAssetMode>(getForcedFortuneAssetMode);

  const aimedTarget = getInteractionTargetById(aimedTargetId);
  const focusedModule = focusedModuleId
    ? getWorldModuleById(focusedModuleId)
    : null;
  const nearestTarget = getInteractionTargetById(nearestTargetId);
  const selectedTarget = getInteractionTargetById(selectedTargetId);
  const selectableTarget = aimedTarget ?? nearestTarget;

  useEffect(() => {
    if (!isCanvasReady || !isTerrainReady) {
      return;
    }

    onReady();
  }, [isCanvasReady, isTerrainReady, onReady]);

  const changeModuleStatus = useCallback((
    moduleId: WorldModuleId,
    status: WorldModuleStatus,
  ) => {
    setModuleStatuses((currentStatuses) => {
      if (currentStatuses[moduleId] === status) {
        return currentStatuses;
      }

      return {
        ...currentStatuses,
        [moduleId]: status,
      };
    });
    setFocusedModuleId(moduleId);
  }, []);

  const focusAreaModule = useCallback((targetId: InteractionTargetId) => {
    setFocusedModuleId(getWorldModuleIdByTargetId(targetId));
    setSelectedTargetId(targetId);
  }, []);

  const selectObject = useCallback((targetId: InteractionTargetId) => {
    setFocusedModuleId(getWorldModuleIdByTargetId(targetId));
    setSelectedTargetId(targetId);
  }, []);

  const activateAimedModuleControl = useCallback(() => {
    if (!aimedModuleControl) {
      return false;
    }

    changeModuleStatus(aimedModuleControl.moduleId, aimedModuleControl.status);
    return true;
  }, [aimedModuleControl, changeModuleStatus]);

  const interactionLines = useMemo(() => {
    if (aimedGomokuTarget) {
      if (aimedGomokuTarget.kind === "control") {
        return [
          `准星命中：五子棋控制屏 / ${aimedGomokuTarget.label}`,
          "左键或 E 触发占位控件；收回棋盘按钮和 H 键已生效。",
        ];
      }

      return [
        `准星命中：${aimedGomokuTarget.label}`,
        "按 G 移动棋盘，按 H 收回棋盘。",
      ];
    }

    if (gomokuHudMessage) {
      return [
        gomokuHudMessage,
        gomokuPlacement
          ? "按 G 可移动位置，按 H 可收回；棋盘和水平控制屏都可以踩上去通过。"
          : "按 G 可在准星指向地面展开棋盘。",
      ];
    }

    if (gomokuPlacement) {
      return [
        "五子棋棋盘已展开；棋盘和控制屏都是可踩水平面。",
        "按 G 移动棋盘，按 H 收回棋盘。",
      ];
    }

    if (aimedModuleControl) {
      return [
        `准星命中：${aimedModuleControl.moduleTitle} / ${aimedModuleControl.label}`,
        "左键或 E 直接切换 3D 表面状态，鼠标焦点保持在 Canvas。",
      ];
    }

    if (focusedModule) {
      return [
        `${focusedModule.title} 常驻在世界表面，可继续移动和转向。`,
        "准星瞄准状态芯片后左键或 E 切换 ready / loading / offline / error。",
      ];
    }

    if (!nearestTarget && !aimedTarget) {
      return [
        "按 G 可展开五子棋棋盘；占卜屋和实验室模块面板已常驻贴在世界表面。",
      ];
    }

    const lines: string[] = [];

    if (nearestTarget) {
      lines.push(nearestTarget.areaPrompt);
    }

    if (aimedTarget) {
      lines.push(aimedTarget.objectPrompt);
    }

    return lines;
  }, [
    aimedGomokuTarget,
    aimedModuleControl,
    aimedTarget,
    focusedModule,
    gomokuHudMessage,
    gomokuPlacement,
    nearestTarget,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape") {
        return;
      }

      setFocusedModuleId(null);
      setSelectedTargetId(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <main className="world-shell" aria-label="gluepudding 3D World">
      <Canvas
        className="world-canvas"
        camera={{
          far: cameraConfig.far,
          fov: cameraConfig.fov,
          near: cameraConfig.near,
          position: cameraConfig.position,
        }}
        tabIndex={0}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.96;
          gl.setClearColor(worldColors.sky);
          gl.shadowMap.type = PCFSoftShadowMap;
          gl.domElement.tabIndex = 0;
          setIsCanvasReady(true);
        }}
        shadows
      >
        <Suspense fallback={null}>
          <WorldRuntime
            aimedGomokuTarget={aimedGomokuTarget}
            aimedModuleControl={aimedModuleControl}
            focusedModuleId={focusedModuleId}
            forcedFortuneAssetMode={forcedFortuneAssetMode}
            gomokuPlacement={gomokuPlacement}
            moduleStatuses={moduleStatuses}
            onActivateArea={focusAreaModule}
            onAimedGomokuTargetChange={setAimedGomokuTarget}
            onAimedModuleControlChange={setAimedModuleControl}
            onGomokuHudMessageChange={setGomokuHudMessage}
            onGomokuPlacementChange={setGomokuPlacement}
            onAimedTargetChange={setAimedTargetId}
            onModuleStatusChange={changeModuleStatus}
            onNearestTargetChange={setNearestTargetId}
            onSelectObject={selectObject}
            onTerrainReadyChange={setIsTerrainReady}
            selectedTargetId={selectedTargetId}
          />
        </Suspense>
      </Canvas>

      <div className="world-hud" aria-label="3D 世界状态">
        <div className="world-status">
          <span>Layer 5.5</span>
          <strong>
            {aimedModuleControl
              ? "Surface Control"
              : focusedModule
                ? "Module Focused"
                : "World Active"}
          </strong>
        </div>
      </div>

      <div
        aria-label={
          aimedGomokuTarget
            ? `准星命中五子棋：${aimedGomokuTarget.label}`
            : aimedModuleControl
            ? `准星命中模块控件：${aimedModuleControl.moduleTitle} ${aimedModuleControl.label}`
            : aimedTarget
              ? `准星对准：${aimedTarget.label}`
              : "中心准星"
        }
        className={`world-crosshair${
          aimedTarget || aimedModuleControl || aimedGomokuTarget ? " is-aimed" : ""
        }`}
      />

      <div className="world-interaction-bar" aria-live="polite">
        <div>
          {interactionLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        {selectedTarget ? (
          <strong>当前选中：{selectedTarget.label}</strong>
        ) : null}
      </div>

      <div className="world-touch-actions" aria-label="移动端交互操作">
        <button
          disabled={!aimedModuleControl && !nearestTarget}
          onClick={() => {
            if (activateAimedModuleControl()) {
              return;
            }

            if (nearestTarget) {
              focusAreaModule(nearestTarget.id);
            }
          }}
          type="button"
        >
          Interact
        </button>
        <button
          disabled={!aimedModuleControl && !selectableTarget}
          onClick={() => {
            if (activateAimedModuleControl()) {
              return;
            }

            if (selectableTarget) {
              selectObject(selectableTarget.id);
            }
          }}
          type="button"
        >
          Select
        </button>
      </div>
    </main>
  );
}
