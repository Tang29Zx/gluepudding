import { useGLTF } from "@react-three/drei";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Mesh, type Group } from "three";
import {
  TrackedModelGate,
  type ModelDownloadProgressHandler,
} from "../assets/TrackedModelGate";
import { backgroundWorldAssets } from "../assets/worldAssetManifest";
import { worldScenery, worldTerrain } from "./sceneConfig";

export type SakuraLevel = "low" | "mid" | "high";

const sakuraLevelRank: Record<SakuraLevel, number> = {
  low: 0,
  mid: 1,
  high: 2,
};
const sakuraMidAssets = [backgroundWorldAssets[0]] as const;
const sakuraHighAssets = [backgroundWorldAssets[1]] as const;

function cloneScenery(scene: Group, shouldCastShadow = true): Group {
  const clonedScene = scene.clone(true);

  clonedScene.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = shouldCastShadow;
      object.receiveShadow = true;
    }
  });

  return clonedScene;
}

function SceneryModel({
  modelUrl,
  shouldCastShadow = true,
  visible = true,
}: {
  modelUrl: string;
  shouldCastShadow?: boolean;
  visible?: boolean;
}) {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(
    () => cloneScenery(gltf.scene, shouldCastShadow),
    [gltf.scene, shouldCastShadow],
  );

  return <primitive object={scene} visible={visible} />;
}

export function IslandScenery({
  isVisible,
  onDeferredLevelReady,
  onModelDownloadProgressChange,
  onReadyChange,
  requestedLevel,
}: {
  isVisible: boolean;
  onDeferredLevelReady: (level: Exclude<SakuraLevel, "low">) => void;
  onModelDownloadProgressChange: ModelDownloadProgressHandler;
  onReadyChange: (isReady: boolean) => void;
  requestedLevel: SakuraLevel;
}) {
  const [activeLevel, setActiveLevel] = useState<SakuraLevel>("low");

  useLayoutEffect(() => {
    onReadyChange(true);

    return () => {
      onReadyChange(false);
    };
  }, [onReadyChange]);

  const handleLevelReady = useCallback(
    (level: Exclude<SakuraLevel, "low">) => {
      setActiveLevel((currentLevel) =>
        sakuraLevelRank[level] > sakuraLevelRank[currentLevel]
          ? level
          : currentLevel,
      );
      onDeferredLevelReady(level);
    },
    [onDeferredLevelReady],
  );
  const handleMidReady = useCallback(() => {
    handleLevelReady("mid");
  }, [handleLevelReady]);
  const handleHighReady = useCallback(() => {
    handleLevelReady("high");
  }, [handleLevelReady]);

  return (
    <group
      position={worldTerrain.position}
      scale={worldTerrain.scale}
      visible={isVisible}
    >
      <SceneryModel
        modelUrl={worldScenery.decorModelUrl}
        shouldCastShadow={false}
      />
      <SceneryModel
        modelUrl={worldScenery.sakuraLowModelUrl}
        shouldCastShadow={false}
        visible={activeLevel === "low"}
      />
      {sakuraLevelRank[requestedLevel] >= sakuraLevelRank.mid ? (
        <TrackedModelGate
          assets={sakuraMidAssets}
          groupLabel="樱花树中景模型"
          onProgressChange={onModelDownloadProgressChange}
          onReady={handleMidReady}
          priority={20}
          taskId="sakura-mid"
        >
          <SceneryModel
            modelUrl={worldScenery.sakuraMidModelUrl}
            shouldCastShadow={false}
            visible={activeLevel === "mid"}
          />
        </TrackedModelGate>
      ) : null}
      {requestedLevel === "high" ? (
        <TrackedModelGate
          assets={sakuraHighAssets}
          groupLabel="樱花树近景模型"
          onProgressChange={onModelDownloadProgressChange}
          onReady={handleHighReady}
          priority={30}
          taskId="sakura-high"
        >
          <SceneryModel
            modelUrl={worldScenery.sakuraHighModelUrl}
            shouldCastShadow
            visible={activeLevel === "high"}
          />
        </TrackedModelGate>
      ) : null}
    </group>
  );
}
