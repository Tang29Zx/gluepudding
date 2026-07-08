import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
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
  aimedModuleControl: AimedWorldModuleControl | null;
  focusedModuleId: WorldModuleId | null;
  forcedFortuneAssetMode: ForcedFortuneAssetMode;
  moduleStatuses: Record<WorldModuleId, WorldModuleStatus>;
  onActivateArea: (targetId: InteractionTargetId) => void;
  onAimedModuleControlChange: (
    control: AimedWorldModuleControl | null,
  ) => void;
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
  aimedModuleControl,
  focusedModuleId,
  forcedFortuneAssetMode,
  moduleStatuses,
  onActivateArea,
  onAimedModuleControlChange,
  onAimedTargetChange,
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
  const terrainSamplerRef = useRef<TerrainSampler | null>(null);
  const setTerrainSampler = useCallback((sampler: TerrainSampler | null) => {
    if (!sampler) {
      terrainSamplerRef.current = null;
      return;
    }

    terrainSamplerRef.current = {
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

        return sampler.sampleGround(x, z);
      },
    };
  }, [fortuneStageX, fortuneStageY, fortuneStageZ]);
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
        aimedModuleControl={aimedModuleControl}
        moduleStatuses={moduleStatuses}
        onTerrainReadyChange={onTerrainReadyChange}
        onTerrainSamplerChange={setTerrainSampler}
        onActivateArea={onActivateArea}
        onAimedModuleControlChange={onAimedModuleControlChange}
        onAimedTargetChange={onAimedTargetChange}
        onModuleStatusChange={onModuleStatusChange}
        onNearestTargetChange={onNearestTargetChange}
        onSelectObject={onSelectObject}
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
        "三个模块面板已常驻贴在世界表面；靠近区域或准星瞄准按钮即可操作。",
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
  }, [aimedModuleControl, aimedTarget, focusedModule, nearestTarget]);

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
          gl.setClearColor(worldColors.sky);
          gl.domElement.tabIndex = 0;
          setIsCanvasReady(true);
        }}
        shadows
      >
        <Suspense fallback={null}>
          <WorldRuntime
            aimedModuleControl={aimedModuleControl}
            focusedModuleId={focusedModuleId}
            forcedFortuneAssetMode={forcedFortuneAssetMode}
            moduleStatuses={moduleStatuses}
            onActivateArea={focusAreaModule}
            onAimedModuleControlChange={setAimedModuleControl}
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
          <span>Layer 5A</span>
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
          aimedModuleControl
            ? `准星命中模块控件：${aimedModuleControl.moduleTitle} ${aimedModuleControl.label}`
            : aimedTarget
              ? `准星对准：${aimedTarget.label}`
              : "中心准星"
        }
        className={`world-crosshair${
          aimedTarget || aimedModuleControl ? " is-aimed" : ""
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
