import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Vector3,
} from "three";
import {
  createLaboratoryDebugAccessSnapshot,
  getLaboratoryAccess,
  initialLaboratoryAccessSnapshot,
  loginLaboratoryAccess,
  type LaboratoryAccessSnapshot,
} from "../adapters/laboratoryAuth";
import { fortuneAssetLoadingConfig } from "../modules/divination/fortuneModelAssets";
import { playOptionalAudio } from "../audio/playOptionalAudio";
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
import type {
  AimedLaboratoryLoginControl,
} from "../modules/laboratory/LaboratoryLoginScreen";
import type {
  AimedLaboratoryDebugControl,
} from "../modules/laboratory/LaboratoryDebugAccessScreen";
import { CameraRig } from "./CameraRig";
import { GameOverlay } from "../modules/GameOverlay";
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
import { sampleLaboratorySurface } from "./worldColliders";

interface WorldExperienceProps {
  onReady: () => void;
}

type ForcedFortuneAssetMode = "interior" | "shell" | null;

const fortuneFloorNormal = new Vector3(0, 1, 0);

interface WorldRuntimeProps {
  aimedLaboratoryDebugControl: AimedLaboratoryDebugControl | null;
  aimedLaboratoryLoginControl: AimedLaboratoryLoginControl | null;
  aimedGomokuTarget: GomokuAimTarget | null;
  aimedModuleControl: AimedWorldModuleControl | null;
  focusedModuleId: WorldModuleId | null;
  forcedFortuneAssetMode: ForcedFortuneAssetMode;
  gomokuPlacement: GomokuPlacement | null;
  isLoading: boolean;
  isLaboratoryDebugAccessEnabled: boolean;
  isLaboratoryDebugScreenVisible: boolean;
  isLaboratoryLoginInputActive: boolean;
  isLaboratoryLoginScreenVisible: boolean;
  laboratoryAccess: LaboratoryAccessSnapshot;
  moduleStatuses: Record<WorldModuleId, WorldModuleStatus>;
  onActivateArea: (targetId: InteractionTargetId) => void;
  onAimedLaboratoryDebugControlChange: (
    control: AimedLaboratoryDebugControl | null,
  ) => void;
  onAimedGomokuTargetChange: (target: GomokuAimTarget | null) => void;
  onAimedLaboratoryLoginControlChange: (
    control: AimedLaboratoryLoginControl | null,
  ) => void;
  onAimedModuleControlChange: (
    control: AimedWorldModuleControl | null,
  ) => void;
  onGomokuHudMessageChange: (message: string | null) => void;
  onGomokuPlacementChange: (placement: GomokuPlacement | null) => void;
  onLaboratoryLoginInputActiveChange: (isActive: boolean) => void;
  onLaboratoryLoginScreenClose: () => void;
  onLaboratoryLoginSubmit: (
    username: string,
    password: string,
  ) => Promise<LaboratoryAccessSnapshot>;
  onLaboratoryDebugAccessToggle: () => void;
  onLaboratoryTeleportDenied: () => void;
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
  aimedLaboratoryDebugControl,
  aimedLaboratoryLoginControl,
  aimedGomokuTarget,
  aimedModuleControl,
  focusedModuleId,
  forcedFortuneAssetMode,
  gomokuPlacement,
  isLoading,
  isLaboratoryDebugAccessEnabled,
  isLaboratoryDebugScreenVisible,
  isLaboratoryLoginInputActive,
  isLaboratoryLoginScreenVisible,
  laboratoryAccess,
  moduleStatuses,
  onActivateArea,
  onAimedLaboratoryDebugControlChange,
  onAimedGomokuTargetChange,
  onAimedLaboratoryLoginControlChange,
  onAimedModuleControlChange,
  onAimedTargetChange,
  onGomokuHudMessageChange,
  onGomokuPlacementChange,
  onLaboratoryLoginInputActiveChange,
  onLaboratoryLoginScreenClose,
  onLaboratoryLoginSubmit,
  onLaboratoryDebugAccessToggle,
  onLaboratoryTeleportDenied,
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
      sampleGround(x, z, referenceY) {
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

        return rawTerrainSampler.sampleGround(x, z, referenceY);
      },
    };
  }, [fortuneStageX, fortuneStageY, fortuneStageZ, rawTerrainSampler]);
  const worldTerrainSampler = useMemo<TerrainSampler | null>(() => {
    if (!placementTerrainSampler) {
      return null;
    }

    return {
      sampleGround(x, z, referenceY) {
        const terrainSample = placementTerrainSampler.sampleGround(
          x,
          z,
          referenceY,
        );
        const laboratorySample = sampleLaboratorySurface(
          x,
          z,
          terrainSample,
          referenceY,
        );
        const baseSample = laboratorySample ?? terrainSample;

        return (
          sampleGomokuSurface(gomokuPlacement, x, z, baseSample) ??
          baseSample
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
  const canUseLaboratoryTeleport = useCallback(
    () => laboratoryAccess.status === "ready",
    [laboratoryAccess.status],
  );
  const player = usePlayerController({
    canUseLaboratoryTeleport,
    isKeyboardInputCaptured: isLaboratoryLoginInputActive,
    isMovementEnabled: true,
    onLaboratoryTeleportDenied,
    terrainSamplerRef,
  });
  const [shouldLoadFortuneInteriorByDistance, setShouldLoadFortuneInteriorByDistance] =
    useState(false);
  const shouldLoadFortuneInteriorByDistanceRef = useRef(false);
  const footstepTimerRef = useRef(0);
  const footstepPrevRef = useRef([0, 0]);

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

    // footstep sound (outdoor only)
    const prevX = footstepPrevRef.current[0];
    const prevZ = footstepPrevRef.current[1];
    const dx = player.position.current.x - prevX;
    const dz = player.position.current.z - prevZ;
    const moved = Math.sqrt(dx * dx + dz * dz);
    footstepPrevRef.current[0] = player.position.current.x;
    footstepPrevRef.current[1] = player.position.current.z;

    if (!shouldLoadFortuneInteriorByDistanceRef.current && moved > 0.02) {
      const now = performance.now();
      if (now - footstepTimerRef.current > 480) {
        footstepTimerRef.current = now;
        playOptionalAudio("/audio/footstep.mp3", 0.25);
      }
    }
  });

  const shouldLoadFortuneShell = true;
  const shouldLoadFortuneInterior =
    forcedFortuneAssetMode === "interior" ||
      focusedModuleId === "divination" ||
      selectedTargetId === "divination-house" ||
      shouldLoadFortuneInteriorByDistance;

  // music only switches by proximity, not by selection/focus
  const isNearFortuneForMusic = shouldLoadFortuneInteriorByDistance;

  // global background music: loading → world → fortune interior
  // each track keeps its own playback position; switching just pauses/resumes
  const musicRef = useRef<Record<string, HTMLAudioElement | null>>({
    loading: null,
    world: null,
    fortune: null,
  });
  const currentTrackRef = useRef<string | null>(null);

  useEffect(() => {
    // lazy init all three tracks
    const tracks: Record<string, string> = {
      loading: "/audio/loading_bgm.mp3",
      world: "/audio/world_bgm.mp3",
      fortune: "/audio/fortune_bgm.mp3",
    };
    for (const [key, src] of Object.entries(tracks)) {
      if (!musicRef.current[key]) {
        const a = new Audio(src);
        a.loop = true;
        a.volume = 0.3;
        a.preload = "auto";
        musicRef.current[key] = a;
      }
    }

    const target = isLoading ? "loading" : isNearFortuneForMusic ? "fortune" : "world";

    // pause previous track, resume (or start) target
    for (const [key, a] of Object.entries(musicRef.current)) {
      if (!a) continue;
      if (key === target) {
        if (a.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          a.load();
          a.addEventListener("canplaythrough", () => a.play().catch(() => {}), { once: true });
        } else if (a.paused) {
          a.play().catch(() => {});
        }
      } else {
        a.pause();
      }
    }
    currentTrackRef.current = target;

    // retry on first user interaction (bypass autoplay policy)
    const retry = () => {
      const cur = musicRef.current[currentTrackRef.current!];
      if (!cur || !cur.paused) return;
      // wait for enough data if still loading
      if (cur.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        cur.addEventListener("canplaythrough", () => cur.play().catch(() => {}), { once: true });
      } else {
        cur.play().catch(() => {});
      }
    };
    const events = ["click", "keydown", "touchstart"] as const;
    events.forEach((e) => document.addEventListener(e, retry, { once: true }));

    return () => {
      events.forEach((e) => document.removeEventListener(e, retry));
      for (const a of Object.values(musicRef.current)) {
        if (a) { a.pause(); a.src = ""; }
      }
    };
  }, []); // mount only — switching handled by next effect

  // switch track on state change (without recreating Audio instances)
  useEffect(() => {
    const target = isLoading ? "loading" : isNearFortuneForMusic ? "fortune" : "world";
    if (currentTrackRef.current === target) return;

    for (const [key, a] of Object.entries(musicRef.current)) {
      if (!a) continue;
      if (key === target) {
        if (a.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          a.load();
          a.addEventListener("canplaythrough", () => a.play().catch(() => {}), { once: true });
        } else {
          a.play().catch(() => {});
        }
      } else {
        a.pause();
      }
    }
    currentTrackRef.current = target;
  }, [isLoading, isNearFortuneForMusic]);

  return (
    <>
      <CameraRig player={player} />
      <WorldScene
        aimedLaboratoryDebugControl={aimedLaboratoryDebugControl}
        aimedLaboratoryLoginControl={aimedLaboratoryLoginControl}
        aimedGomokuTarget={aimedGomokuTarget}
        aimedModuleControl={aimedModuleControl}
        isLaboratoryDebugAccessEnabled={isLaboratoryDebugAccessEnabled}
        isLaboratoryDebugScreenVisible={isLaboratoryDebugScreenVisible}
        isLaboratoryLoginInputActive={isLaboratoryLoginInputActive}
        isLaboratoryLoginScreenVisible={isLaboratoryLoginScreenVisible}
        laboratoryAccess={laboratoryAccess}
        moduleStatuses={moduleStatuses}
        gomokuPlacement={gomokuPlacement}
        onTerrainReadyChange={onTerrainReadyChange}
        onTerrainSamplerChange={setTerrainSampler}
        onActivateArea={onActivateArea}
        onAimedLaboratoryDebugControlChange={
          onAimedLaboratoryDebugControlChange
        }
        onAimedGomokuTargetChange={onAimedGomokuTargetChange}
        onAimedLaboratoryLoginControlChange={
          onAimedLaboratoryLoginControlChange
        }
        onAimedModuleControlChange={onAimedModuleControlChange}
        onGomokuHudMessageChange={onGomokuHudMessageChange}
        onGomokuPlacementChange={onGomokuPlacementChange}
        onLaboratoryLoginInputActiveChange={
          onLaboratoryLoginInputActiveChange
        }
        onLaboratoryLoginScreenClose={onLaboratoryLoginScreenClose}
        onLaboratoryLoginSubmit={onLaboratoryLoginSubmit}
        onLaboratoryDebugAccessToggle={onLaboratoryDebugAccessToggle}
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

function shouldShowLaboratoryDebugScreen(): boolean {
  const hostname = window.location.hostname;

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    import.meta.env.VITE_LAB_AUTH_DEBUG === "true"
  );
}

export function WorldExperience({ onReady }: WorldExperienceProps) {
  const [aimedLaboratoryDebugControl, setAimedLaboratoryDebugControl] =
    useState<AimedLaboratoryDebugControl | null>(null);
  const [aimedLaboratoryLoginControl, setAimedLaboratoryLoginControl] =
    useState<AimedLaboratoryLoginControl | null>(null);
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
  const [isLaboratoryLoginInputActive, setIsLaboratoryLoginInputActive] =
    useState(false);
  const [isLaboratoryLoginScreenVisible, setIsLaboratoryLoginScreenVisible] =
    useState(false);
  const [laboratoryAccess, setLaboratoryAccess] =
    useState<LaboratoryAccessSnapshot>(initialLaboratoryAccessSnapshot);
  const [laboratoryAccessOverride, setLaboratoryAccessOverride] =
    useState<LaboratoryAccessSnapshot | null>(null);
  const [moduleStatuses, setModuleStatuses] = useState(
    createDefaultWorldModuleStatuses,
  );
  const [nearestTargetId, setNearestTargetId] =
    useState<InteractionTargetId | null>(null);
  const [selectedTargetId, setSelectedTargetId] =
    useState<InteractionTargetId | null>(null);
  const [forcedFortuneAssetMode] =
    useState<ForcedFortuneAssetMode>(getForcedFortuneAssetMode);
  const [isGameOpen, setIsGameOpen] = useState(false);

  const aimedTarget = getInteractionTargetById(aimedTargetId);
  const focusedModule = focusedModuleId
    ? getWorldModuleById(focusedModuleId)
    : null;
  const nearestTarget = getInteractionTargetById(nearestTargetId);
  const selectedTarget = getInteractionTargetById(selectedTargetId);
  const selectableTarget = aimedTarget ?? nearestTarget;
  const effectiveLaboratoryAccess =
    laboratoryAccessOverride ?? laboratoryAccess;
  const isLaboratoryDebugScreenVisible = shouldShowLaboratoryDebugScreen();
  const isLaboratoryDebugAccessEnabled =
    effectiveLaboratoryAccess.status === "ready";

  const refreshLaboratoryAccess = useCallback(async () => {
    const snapshot = await getLaboratoryAccess();

    setLaboratoryAccess(snapshot);
    return snapshot;
  }, []);

  useEffect(() => {
    let isMounted = true;

    void getLaboratoryAccess().then((snapshot) => {
      if (isMounted) {
        setLaboratoryAccess(snapshot);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (effectiveLaboratoryAccess.status !== "ready") {
      return;
    }

    setIsLaboratoryLoginScreenVisible(false);
    setIsLaboratoryLoginInputActive(false);
    setAimedLaboratoryLoginControl(null);
  }, [effectiveLaboratoryAccess.status]);

  useEffect(() => {
    if (isLaboratoryLoginScreenVisible || !isLaboratoryLoginInputActive) {
      return;
    }

    setIsLaboratoryLoginInputActive(false);
    setAimedLaboratoryLoginControl(null);
  }, [isLaboratoryLoginInputActive, isLaboratoryLoginScreenVisible]);

  const showLaboratoryLoginScreen = useCallback(() => {
    setFocusedModuleId("laboratory");
    setSelectedTargetId("laboratory");
    setIsLaboratoryLoginScreenVisible(true);

    if (
      effectiveLaboratoryAccess.status === "checking" ||
      effectiveLaboratoryAccess.status === "error"
    ) {
      void refreshLaboratoryAccess();
    }
  }, [effectiveLaboratoryAccess.status, refreshLaboratoryAccess]);

  const closeLaboratoryLoginScreen = useCallback(() => {
    setIsLaboratoryLoginInputActive(false);
    setIsLaboratoryLoginScreenVisible(false);
    setAimedLaboratoryLoginControl(null);
  }, []);

  const submitLaboratoryLogin = useCallback(
    async (username: string, password: string) => {
      setLaboratoryAccessOverride(null);
      setLaboratoryAccess({
        message: "正在登录",
        status: "loggingIn",
        user: null,
      });

      const snapshot = await loginLaboratoryAccess(username, password);

      setLaboratoryAccess(snapshot);

      if (snapshot.status === "ready") {
        setIsLaboratoryLoginInputActive(false);
        setIsLaboratoryLoginScreenVisible(false);
        setAimedLaboratoryLoginControl(null);
      }

      return snapshot;
    },
    [],
  );

  const toggleLaboratoryDebugAccess = useCallback(() => {
    const nextIsLoggedIn = effectiveLaboratoryAccess.status !== "ready";

    setLaboratoryAccessOverride(
      createLaboratoryDebugAccessSnapshot(nextIsLoggedIn),
    );
    setIsLaboratoryLoginInputActive(false);

    if (nextIsLoggedIn) {
      setIsLaboratoryLoginScreenVisible(false);
      setAimedLaboratoryLoginControl(null);
    }
  }, [effectiveLaboratoryAccess.status]);

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
    if (targetId === "game-door") {
      setIsGameOpen(true);
      return;
    }
    setFocusedModuleId(getWorldModuleIdByTargetId(targetId));
    setSelectedTargetId(targetId);
  }, []);

  const selectObject = useCallback((targetId: InteractionTargetId) => {
    if (targetId === "game-door") {
      setIsGameOpen(true);
      return;
    }
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
    if (aimedLaboratoryDebugControl) {
      return [
        "准星命中：出生点测试屏 / 登录切换",
        "左键切换实验室测试登录状态；正式上线后替换为说明 / 关于。",
      ];
    }

    if (aimedLaboratoryLoginControl) {
      return [
        `准星命中：实验室登录 / ${aimedLaboratoryLoginControl.label}`,
        "左键选择输入框；输入时按 Esc 或点击框外恢复移动。",
      ];
    }

    if (isLaboratoryLoginInputActive) {
      return [
        "正在输入实验室登录信息。",
        "键盘输入只进入当前框，鼠标仍可转向；Esc 取消输入。",
      ];
    }

    if (isLaboratoryLoginScreenVisible) {
      return [
        "进入天空实验室需要 admin/armbot/door 权限。",
        "准星对准用户名或密码框后左键开始输入。",
      ];
    }

    if (aimedGomokuTarget) {
      if (aimedGomokuTarget.kind === "control") {
        return [
          `准星命中：五子棋控制屏 / ${aimedGomokuTarget.label}`,
          "左键或 E 操作悔棋、重开、AI 强度或收回棋盘。",
        ];
      }

      return [
        `准星命中：${aimedGomokuTarget.label}`,
        "左键落子；按 G 移动棋盘，按 H 收回棋盘。",
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
        "五子棋棋盘已展开；玩家执黑，AI 执白。",
        "左键棋盘交叉点落子；按 G 移动棋盘，按 H 收回棋盘。",
      ];
    }

    if (aimedModuleControl) {
      return [
        `准星命中：${aimedModuleControl.moduleTitle} / ${aimedModuleControl.label}`,
        "左键或 E 直接切换 3D 表面状态，鼠标焦点保持在 Canvas。",
      ];
    }

    if (focusedModule) {
      if (focusedModule.id === "laboratory") {
        return [
          effectiveLaboratoryAccess.status === "ready"
            ? "实验室权限已通过；传送台上按 Space 上行。"
            : "传送台上按 Space 会先检查实验室权限。",
          "天空实验室大屏已接入视频纹理。",
        ];
      }

      return [
        `${focusedModule.title} 常驻在世界表面，可继续移动和转向。`,
        "准星瞄准状态芯片后左键或 E 切换 ready / loading / offline / error。",
      ];
    }

    if (!nearestTarget && !aimedTarget) {
      return [
        "按 G 可展开五子棋棋盘；天空实验室大屏已使用视频纹理承载外部世界。",
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
    aimedLaboratoryDebugControl,
    aimedLaboratoryLoginControl,
    aimedModuleControl,
    aimedTarget,
    focusedModule,
    gomokuHudMessage,
    gomokuPlacement,
    isLaboratoryLoginInputActive,
    isLaboratoryLoginScreenVisible,
    effectiveLaboratoryAccess.status,
    nearestTarget,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape") {
        return;
      }

      if (isLaboratoryLoginInputActive) {
        event.preventDefault();
        event.stopPropagation();
        setIsLaboratoryLoginInputActive(false);
        setAimedLaboratoryLoginControl(null);
        return;
      }

      setFocusedModuleId(null);
      setSelectedTargetId(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isLaboratoryLoginInputActive]);

  useEffect(() => {
    if (!isLaboratoryLoginInputActive) {
      return;
    }

    const handleClick = () => {
      if (aimedLaboratoryLoginControl) {
        return;
      }

      setIsLaboratoryLoginInputActive(false);
    };

    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("click", handleClick, true);
    };
  }, [aimedLaboratoryLoginControl, isLaboratoryLoginInputActive]);

  return (
    <>
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
            aimedLaboratoryDebugControl={aimedLaboratoryDebugControl}
            aimedLaboratoryLoginControl={aimedLaboratoryLoginControl}
            aimedGomokuTarget={aimedGomokuTarget}
            aimedModuleControl={aimedModuleControl}
            focusedModuleId={focusedModuleId}
            forcedFortuneAssetMode={forcedFortuneAssetMode}
            gomokuPlacement={gomokuPlacement}
            isLoading={!isCanvasReady || !isTerrainReady}
            isLaboratoryDebugAccessEnabled={isLaboratoryDebugAccessEnabled}
            isLaboratoryDebugScreenVisible={isLaboratoryDebugScreenVisible}
            isLaboratoryLoginInputActive={isLaboratoryLoginInputActive}
            isLaboratoryLoginScreenVisible={isLaboratoryLoginScreenVisible}
            laboratoryAccess={effectiveLaboratoryAccess}
            moduleStatuses={moduleStatuses}
            onActivateArea={focusAreaModule}
            onAimedLaboratoryDebugControlChange={
              setAimedLaboratoryDebugControl
            }
            onAimedGomokuTargetChange={setAimedGomokuTarget}
            onAimedLaboratoryLoginControlChange={
              setAimedLaboratoryLoginControl
            }
            onAimedModuleControlChange={setAimedModuleControl}
            onGomokuHudMessageChange={setGomokuHudMessage}
            onGomokuPlacementChange={setGomokuPlacement}
            onLaboratoryLoginInputActiveChange={
              setIsLaboratoryLoginInputActive
            }
            onLaboratoryLoginScreenClose={closeLaboratoryLoginScreen}
            onLaboratoryLoginSubmit={submitLaboratoryLogin}
            onLaboratoryDebugAccessToggle={toggleLaboratoryDebugAccess}
            onLaboratoryTeleportDenied={showLaboratoryLoginScreen}
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
          aimedLaboratoryDebugControl
            ? `准星命中出生点测试屏：${aimedLaboratoryDebugControl.label}`
            : aimedLaboratoryLoginControl
            ? `准星命中实验室登录：${aimedLaboratoryLoginControl.label}`
            : aimedGomokuTarget
            ? `准星命中五子棋：${aimedGomokuTarget.label}`
            : aimedModuleControl
            ? `准星命中模块控件：${aimedModuleControl.moduleTitle} ${aimedModuleControl.label}`
            : aimedTarget
              ? `准星对准：${aimedTarget.label}`
              : "中心准星"
        }
        className={`world-crosshair${
          aimedTarget ||
          aimedModuleControl ||
          aimedGomokuTarget ||
          aimedLaboratoryDebugControl ||
          aimedLaboratoryLoginControl
            ? " is-aimed"
            : ""
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
          disabled={
            isLaboratoryLoginScreenVisible ||
            isLaboratoryLoginInputActive ||
            (!aimedModuleControl && !nearestTarget)
          }
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
          disabled={
            isLaboratoryLoginScreenVisible ||
            isLaboratoryLoginInputActive ||
            (!aimedModuleControl && !selectableTarget)
          }
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
    {isGameOpen && <GameOverlay onClose={() => setIsGameOpen(false)} />}
    </>
  );
}
