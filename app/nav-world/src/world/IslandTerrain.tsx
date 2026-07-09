import { useGLTF } from "@react-three/drei";
import {
  Component,
  useLayoutEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  Camera,
  Group,
  Light,
  Mesh,
  Raycaster,
  Vector3,
} from "three";
import type { Intersection } from "three";
import type { TerrainSampler } from "./terrainSampler";
import { worldTerrain } from "./sceneConfig";

interface IslandTerrainProps {
  isVisible?: boolean;
  onTerrainReadyChange: (isReady: boolean) => void;
  onTerrainSamplerChange: (sampler: TerrainSampler | null) => void;
}

interface WorldTerrainErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
}

interface WorldTerrainErrorBoundaryState {
  hasError: boolean;
}

const raycastDirection = new Vector3(0, -1, 0);
const fallbackGroundNormal = new Vector3(0, 1, 0);

export class WorldTerrainErrorBoundary extends Component<
  WorldTerrainErrorBoundaryProps,
  WorldTerrainErrorBoundaryState
> {
  state: WorldTerrainErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WorldTerrainErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.warn("Island terrain failed to render.", error, errorInfo);
    this.props.onError();
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function findWalkableMeshes(root: Group): Mesh[] {
  const walkableMeshNames = new Set<string>(worldTerrain.walkableMeshNames);
  const walkableMeshes: Mesh[] = [];

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    if (
      walkableMeshNames.has(object.name) ||
      walkableMeshNames.has(object.geometry.name)
    ) {
      walkableMeshes.push(object);
    }
  });

  return walkableMeshes;
}

function getWorldNormal(intersection: Intersection, mesh: Mesh): Vector3 {
  if (!intersection.face) {
    return fallbackGroundNormal;
  }

  return intersection.face.normal
    .clone()
    .transformDirection(mesh.matrixWorld);
}

function createTerrainSampler(walkableMeshes: readonly Mesh[]): TerrainSampler {
  const raycaster = new Raycaster();
  const rayOrigin = new Vector3();

  return {
    sampleGround(x: number, z: number) {
      rayOrigin.set(x, worldTerrain.raycastStartY, z);
      raycaster.set(rayOrigin, raycastDirection);
      raycaster.far = worldTerrain.raycastDistance;

      let bestGroundSample: ReturnType<TerrainSampler["sampleGround"]> = null;

      for (const walkableMesh of walkableMeshes) {
        walkableMesh.updateWorldMatrix(true, false);

        for (const intersection of raycaster.intersectObject(walkableMesh, false)) {
          const normal = getWorldNormal(intersection, walkableMesh);

          if (normal.y < worldTerrain.minWalkableNormalY) {
            continue;
          }

          if (
            !bestGroundSample ||
            intersection.point.y > bestGroundSample.y
          ) {
            bestGroundSample = {
              normal,
              y: intersection.point.y,
            };
          }
        }
      }

      return bestGroundSample;
    },
  };
}

export function IslandTerrain({
  isVisible = true,
  onTerrainReadyChange,
  onTerrainSamplerChange,
}: IslandTerrainProps) {
  const gltf = useGLTF(worldTerrain.modelUrl);
  const rootRef = useRef<Group>(null);
  const scene = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);

    clonedScene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        return;
      }

      if (object instanceof Camera || object instanceof Light) {
        object.visible = false;
      }
    });

    return clonedScene;
  }, [gltf.scene]);

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root) {
      onTerrainSamplerChange(null);
      onTerrainReadyChange(false);
      return undefined;
    }

    root.updateWorldMatrix(true, true);

    const walkableMeshes = findWalkableMeshes(root);

    if (walkableMeshes.length === 0) {
      console.warn("Walkable terrain mesh was not found in island.glb.");
      onTerrainSamplerChange(null);
      onTerrainReadyChange(true);
      return undefined;
    }

    const sampler = createTerrainSampler(walkableMeshes);
    onTerrainSamplerChange(sampler);
    onTerrainReadyChange(true);

    return () => {
      onTerrainSamplerChange(null);
      onTerrainReadyChange(false);
    };
  }, [onTerrainReadyChange, onTerrainSamplerChange, scene]);

  return (
    <group
      position={worldTerrain.position}
      ref={rootRef}
      scale={worldTerrain.scale}
      visible={isVisible}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(worldTerrain.modelUrl);
