import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  Vector3,
} from "three";
import {
  getLaboratoryAccess,
  initialLaboratoryAccessSnapshot,
  loginLaboratoryAccess,
  type LaboratoryAccessSnapshot,
} from "../adapters/laboratoryAuth";
import { staticAssetUrl } from "../assets/staticAssetUrl";
import {
  FortuneAiAuthProvider,
  useFortuneAiAuth,
} from "../auth/FortuneAiAuthContext";
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
import type {
  AimedLaboratoryLoginControl,
} from "../modules/laboratory/LaboratoryLoginScreen";
import type {
  AimedLaboratoryDebugControl,
} from "../modules/laboratory/LaboratoryDebugAccessScreen";
import { CameraRig } from "./CameraRig";
import {
  fortuneRoomConfig,
  fortuneLocalToWorld,
  fortuneWorldToLocal,
  isWithinFortuneDoorLane,
  type FortuneRoomState,
} from "./fortuneRoomConfig";
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

function smoothProgress(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));

  return clamped * clamped * (3 - 2 * clamped);
}

interface WorldRuntimeProps {
  aimedLaboratoryDebugControl: AimedLaboratoryDebugControl | null;
  aimedLaboratoryLoginControl: AimedLaboratoryLoginControl | null;
  aimedGomokuTarget: GomokuAimTarget | null;
  aimedModuleControl: AimedWorldModuleControl | null;
  focusedModuleId: WorldModuleId | null;
  forcedFortuneAssetMode: ForcedFortuneAssetMode;
  gomokuPlacement: GomokuPlacement | null;
  isFortuneAiLoginInputActive: boolean;
  isLoading: boolean;
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
  onLaboratoryAccessRefresh: () => Promise<LaboratoryAccessSnapshot>;
  onLaboratoryTeleportDenied: () => void;
  onAimedTargetChange: (targetId: InteractionTargetId | null) => void;
  onFortuneInteriorReadyChange: (isReady: boolean) => void;
  onFortuneMistOpacityChange: (opacity: number) => void;
  onFortuneRoomStateChange: (state: FortuneRoomState) => void;
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
  isFortuneAiLoginInputActive,
  isLoading,
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
  onFortuneInteriorReadyChange,
  onFortuneMistOpacityChange,
  onFortuneRoomStateChange,
  onGomokuHudMessageChange,
  onGomokuPlacementChange,
  onLaboratoryLoginInputActiveChange,
  onLaboratoryLoginScreenClose,
  onLaboratoryLoginSubmit,
  onLaboratoryAccessRefresh,
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
    async () => {
      const snapshot = await onLaboratoryAccessRefresh();

      return snapshot.status === "ready";
    },
    [onLaboratoryAccessRefresh],
  );
  const [fortuneRoomState, setFortuneRoomState] =
    useState<FortuneRoomState>("outside");
  const [isPlayerInsideFortuneRoom, setIsPlayerInsideFortuneRoom] =
    useState(false);
  const fortuneMistOpacityRef = useRef(0);
  const fortuneRoomStateRef = useRef<FortuneRoomState>("outside");
  const fortuneInteriorReadyRef = useRef(false);
  const isPlayerInsideFortuneRoomRef = useRef(false);
  const fortuneTransitionRef = useRef<{
    hasSwitchedVisibility: boolean;
    phase: "entering" | "exiting";
    revealStartedAt: number | null;
    startedAt: number;
  } | null>(null);
  const isFortuneRoomTransitionActive =
    fortuneRoomState === "entering" || fortuneRoomState === "exiting";
  const player = usePlayerController({
    canUseLaboratoryTeleport,
    isKeyboardInputCaptured:
      isFortuneAiLoginInputActive || isLaboratoryLoginInputActive,
    isLocomotionEnabled: !isFortuneRoomTransitionActive,
    isMovementEnabled: true,
    onLaboratoryTeleportDenied,
    terrainSamplerRef,
  });
  const [shouldLoadFortuneInteriorByDistance, setShouldLoadFortuneInteriorByDistance] =
    useState(false);
  const shouldLoadFortuneInteriorByDistanceRef = useRef(false);
  const footstepTimerRef = useRef(0);
  const footstepPrevRef = useRef([0, 0]);
  const setFortuneRoomStateValue = useCallback(
    (state: FortuneRoomState) => {
      if (fortuneRoomStateRef.current === state) {
        return;
      }

      fortuneRoomStateRef.current = state;
      setFortuneRoomState(state);
      onFortuneRoomStateChange(state);
    },
    [onFortuneRoomStateChange],
  );
  const setFortuneMistOpacityValue = useCallback(
    (opacity: number) => {
      const nextOpacity = Math.min(1, Math.max(0, opacity));

      if (Math.abs(fortuneMistOpacityRef.current - nextOpacity) < 0.012) {
        return;
      }

      fortuneMistOpacityRef.current = nextOpacity;
      onFortuneMistOpacityChange(nextOpacity);
    },
    [onFortuneMistOpacityChange],
  );
  const setPlayerInsideFortuneRoomValue = useCallback((isInside: boolean) => {
    if (isPlayerInsideFortuneRoomRef.current === isInside) {
      return;
    }

    isPlayerInsideFortuneRoomRef.current = isInside;
    setIsPlayerInsideFortuneRoom(isInside);
  }, []);
  const setFortuneInteriorReadyValue = useCallback(
    (isReady: boolean) => {
      fortuneInteriorReadyRef.current = isReady;
      onFortuneInteriorReadyChange(isReady);
    },
    [onFortuneInteriorReadyChange],
  );
  const movePlayerToFortuneLanding = useCallback(
    (phase: "entering" | "exiting") => {
      const currentLocalPosition = fortuneWorldToLocal(
        player.position.current.x,
        player.position.current.z,
      );
      const landingLocalX = Math.min(
        fortuneRoomConfig.landingHalfWidth,
        Math.max(
          -fortuneRoomConfig.landingHalfWidth,
          currentLocalPosition.localX,
        ),
      );
      const landingLocalZ =
        phase === "entering"
          ? fortuneRoomConfig.enterLandingLocalZ
          : fortuneRoomConfig.exitLandingLocalZ;
      const landingPosition = fortuneLocalToWorld(landingLocalX, landingLocalZ);

      player.clearMovement();
      player.position.current.set(
        landingPosition.x,
        fortuneStageY + fortuneAssetLoadingConfig.floorSurfaceOffset,
        landingPosition.z,
      );
    },
    [fortuneStageY, player],
  );
  const startFortuneRoomTransition = useCallback(
    (phase: "entering" | "exiting") => {
      if (fortuneTransitionRef.current) {
        return;
      }

      player.clearMovement();
      if (phase === "entering" && forcedFortuneAssetMode !== "interior") {
        setFortuneInteriorReadyValue(false);
      }
      fortuneTransitionRef.current = {
        hasSwitchedVisibility: false,
        phase,
        revealStartedAt: null,
        startedAt: performance.now(),
      };
      setFortuneRoomStateValue(phase);
      setFortuneMistOpacityValue(1);
    },
    [
      forcedFortuneAssetMode,
      player,
      setFortuneInteriorReadyValue,
      setFortuneMistOpacityValue,
      setFortuneRoomStateValue,
    ],
  );

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

    const localFortunePosition = fortuneWorldToLocal(
      player.position.current.x,
      player.position.current.z,
    );
    const isInFortuneDoorLane = isWithinFortuneDoorLane(localFortunePosition);

    if (!fortuneTransitionRef.current && isInFortuneDoorLane) {
      if (
        !isPlayerInsideFortuneRoomRef.current &&
        localFortunePosition.localZ > fortuneRoomConfig.exitLocalZ
      ) {
        startFortuneRoomTransition("entering");
      } else if (
        isPlayerInsideFortuneRoomRef.current &&
        localFortunePosition.localZ < fortuneRoomConfig.exitLocalZ
      ) {
        startFortuneRoomTransition("exiting");
      }
    }

    const fortuneTransition = fortuneTransitionRef.current;

    if (fortuneTransition) {
      const now = performance.now();
      const elapsedMs = now - fortuneTransition.startedAt;
      const coverMs = fortuneRoomConfig.transitionCoverMs;
      const revealMs = fortuneRoomConfig.transitionRevealMs;

      if (elapsedMs < coverMs) {
        setFortuneMistOpacityValue(1);
      } else {
        if (!fortuneTransition.hasSwitchedVisibility) {
          const nextIsInside = fortuneTransition.phase === "entering";

          movePlayerToFortuneLanding(fortuneTransition.phase);
          setPlayerInsideFortuneRoomValue(nextIsInside);
          fortuneTransition.hasSwitchedVisibility = true;
          setFortuneMistOpacityValue(1);
          return;
        }

        if (
          fortuneTransition.phase === "entering" &&
          !fortuneInteriorReadyRef.current
        ) {
          setFortuneMistOpacityValue(1);
          return;
        }

        if (fortuneTransition.revealStartedAt === null) {
          fortuneTransition.revealStartedAt = now;
        }

        const revealProgress =
          (now - fortuneTransition.revealStartedAt) / revealMs;
        setFortuneMistOpacityValue(1 - smoothProgress(revealProgress));

        if (revealProgress >= 1) {
          const nextState =
            fortuneTransition.phase === "entering" ? "inside" : "outside";

          fortuneTransitionRef.current = null;
          setFortuneMistOpacityValue(0);
          setFortuneRoomStateValue(nextState);
        }
      }
    }

    // footstep timing is kept for future audio assets; no request is made when
    // the optional footstep file is not shipped.
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
      }
    }
  });

  const shouldLoadFortuneInterior =
    forcedFortuneAssetMode === "interior" ||
      focusedModuleId === "divination" ||
      selectedTargetId === "divination-house" ||
      shouldLoadFortuneInteriorByDistance ||
      isPlayerInsideFortuneRoom;
  const shouldLoadFortuneShell = true;
  const isFortuneRoomInteriorVisible =
    forcedFortuneAssetMode === "interior" || isPlayerInsideFortuneRoom;

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
    const tracks: Record<string, string> = {
      loading: staticAssetUrl("/audio/loading_bgm.mp3"),
      world: staticAssetUrl("/audio/world_bgm.mp3"),
      fortune: staticAssetUrl("/audio/fortune_bgm.mp3"),
    };
    const target = isLoading ? "loading" : isNearFortuneForMusic ? "fortune" : "world";

    for (const [key, src] of Object.entries(tracks)) {
      if (!musicRef.current[key]) {
        const a = new Audio();
        a.loop = true;
        a.volume = 0.3;
        a.preload = key === target ? "auto" : "none";
        a.src = src;
        musicRef.current[key] = a;
      }
    }

    // pause previous track, resume (or start) target
    for (const [key, a] of Object.entries(musicRef.current)) {
      if (!a) continue;
      if (key === target) {
        a.preload = "auto";
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
        a.preload = "auto";
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
        fortuneRoomState={fortuneRoomState}
        isFortuneRoomInteriorVisible={isFortuneRoomInteriorVisible}
        isLaboratoryDebugScreenVisible={isLaboratoryDebugScreenVisible}
        isLaboratoryLoginInputActive={isLaboratoryLoginInputActive}
        isLaboratoryLoginScreenVisible={isLaboratoryLoginScreenVisible}
        isPlayerInsideFortuneRoom={isPlayerInsideFortuneRoom}
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
        onAimedTargetChange={onAimedTargetChange}
        onFortuneInteriorReadyChange={setFortuneInteriorReadyValue}
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

export function WorldExperience(props: WorldExperienceProps) {
  return (
    <FortuneAiAuthProvider>
      <WorldExperienceContent {...props} />
    </FortuneAiAuthProvider>
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

function WorldExperienceContent({ onReady }: WorldExperienceProps) {
  const {
    cancelLogin: cancelFortuneAiLogin,
    isInputActive: isFortuneAiLoginInputActive,
    isLoginVisible: isFortuneAiLoginVisible,
  } = useFortuneAiAuth();
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
  const [fortuneRoomState, setFortuneRoomState] =
    useState<FortuneRoomState>("outside");
  const [fortuneMistOpacity, setFortuneMistOpacity] = useState(0);
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
  const worldCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const aimedTarget = getInteractionTargetById(aimedTargetId);
  const focusedModule = focusedModuleId
    ? getWorldModuleById(focusedModuleId)
    : null;
  const nearestTarget = getInteractionTargetById(nearestTargetId);
  const selectedTarget = getInteractionTargetById(selectedTargetId);
  const selectableTarget = aimedTarget ?? nearestTarget;
  const isLaboratoryDebugScreenVisible = shouldShowLaboratoryDebugScreen();

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
    if (laboratoryAccess.status !== "ready") {
      return;
    }

    setIsLaboratoryLoginScreenVisible(false);
    setIsLaboratoryLoginInputActive(false);
    setAimedLaboratoryLoginControl(null);
  }, [laboratoryAccess.status]);

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
      laboratoryAccess.status === "checking" ||
      laboratoryAccess.status === "error"
    ) {
      void refreshLaboratoryAccess();
    }
  }, [laboratoryAccess.status, refreshLaboratoryAccess]);

  const closeLaboratoryLoginScreen = useCallback(() => {
    setIsLaboratoryLoginInputActive(false);
    setIsLaboratoryLoginScreenVisible(false);
    setAimedLaboratoryLoginControl(null);
  }, []);

  const submitLaboratoryLogin = useCallback(
    async (username: string, password: string) => {
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

    if (targetId === "divination-house") {
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

    if (targetId === "divination-house") {
      return;
    }

    setFocusedModuleId(getWorldModuleIdByTargetId(targetId));
    setSelectedTargetId(targetId);
  }, []);

  const restoreWorldPointerLock = useCallback(() => {
    const canvas = worldCanvasRef.current;

    if (!canvas || document.pointerLockElement === canvas) {
      return;
    }

    try {
      void Promise.resolve(canvas.requestPointerLock()).catch(() => {
        console.warn("Pointer lock unavailable; 3D world remains active.");
      });
    } catch {
      console.warn("Pointer lock unavailable; 3D world remains active.");
    }
  }, []);

  const closeGameOverlay = useCallback(() => {
    restoreWorldPointerLock();
    setIsGameOpen(false);
  }, [restoreWorldPointerLock]);

  const activateAimedModuleControl = useCallback(() => {
    if (!aimedModuleControl) {
      return false;
    }

    changeModuleStatus(aimedModuleControl.moduleId, aimedModuleControl.status);
    return true;
  }, [aimedModuleControl, changeModuleStatus]);
  const ignoreFortuneInteriorReady = useCallback((_isReady: boolean) => {}, []);

  const interactionLines = useMemo(() => {
    if (fortuneRoomState === "entering") {
      return [
        "门口迷雾正在聚拢。",
        "雾散后会进入占卜屋，外面的世界会被隔绝。",
      ];
    }

    if (fortuneRoomState === "exiting") {
      return [
        "门口迷雾正在重新聚拢。",
        "雾散后会回到外部世界。",
      ];
    }

    if (fortuneRoomState === "inside") {
      return [
        "占卜屋内：塔罗、星座、周易都在室内完成。",
        "回到门口穿过迷雾可离开。",
      ];
    }

    if (aimedLaboratoryDebugControl) {
      return [
        "准星命中：资源版权与备案",
        "当前小屏列出 3D 模型资源授权和网站备案信息。",
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
          laboratoryAccess.status === "ready"
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
    fortuneRoomState,
    gomokuHudMessage,
    gomokuPlacement,
    isLaboratoryLoginInputActive,
    isLaboratoryLoginScreenVisible,
    laboratoryAccess.status,
    nearestTarget,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape") {
        return;
      }

      if (isFortuneAiLoginVisible) {
        event.preventDefault();
        event.stopPropagation();
        cancelFortuneAiLogin();
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
  }, [
    cancelFortuneAiLogin,
    isFortuneAiLoginVisible,
    isLaboratoryLoginInputActive,
  ]);

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

  useEffect(() => {
    if (fortuneRoomState === "outside") {
      return;
    }

    setAimedTargetId(null);
    setNearestTargetId(null);
    setAimedModuleControl(null);
    setAimedGomokuTarget(null);
    setAimedLaboratoryDebugControl(null);
    setAimedLaboratoryLoginControl(null);
    setIsLaboratoryLoginInputActive(false);
    setIsLaboratoryLoginScreenVisible(false);

    if (fortuneRoomState === "inside") {
      setFocusedModuleId(null);
      setSelectedTargetId(null);
    }
  }, [fortuneRoomState]);

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
        dpr={[1, 1.35]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          worldCanvasRef.current = gl.domElement;
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.96;
          gl.setClearColor(worldColors.sky);
          gl.shadowMap.type = PCFShadowMap;
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
            isFortuneAiLoginInputActive={isFortuneAiLoginInputActive}
            isLoading={!isCanvasReady || !isTerrainReady}
            isLaboratoryDebugScreenVisible={isLaboratoryDebugScreenVisible}
            isLaboratoryLoginInputActive={isLaboratoryLoginInputActive}
            isLaboratoryLoginScreenVisible={isLaboratoryLoginScreenVisible}
            laboratoryAccess={laboratoryAccess}
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
            onLaboratoryAccessRefresh={refreshLaboratoryAccess}
            onLaboratoryTeleportDenied={showLaboratoryLoginScreen}
            onAimedTargetChange={setAimedTargetId}
            onFortuneInteriorReadyChange={ignoreFortuneInteriorReady}
            onFortuneMistOpacityChange={setFortuneMistOpacity}
            onFortuneRoomStateChange={setFortuneRoomState}
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
            ? `准星命中资源版权与备案：${aimedLaboratoryDebugControl.label}`
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

      <div
        aria-hidden="true"
        className="fortune-mist-overlay"
        style={{ opacity: fortuneMistOpacity }}
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
            isFortuneAiLoginVisible ||
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
            isFortuneAiLoginVisible ||
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
    {isGameOpen && <GameOverlay onClose={closeGameOverlay} />}
    </>
  );
}
