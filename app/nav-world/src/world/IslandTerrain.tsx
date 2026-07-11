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
  Color,
  Group,
  Light,
  Material,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from "three";
import type { Intersection } from "three";
import type { TerrainSampler } from "./terrainSampler";
import { worldTerrain } from "./sceneConfig";

interface IslandTerrainProps {
  isVisible?: boolean;
  modelUrl?: string;
  onTerrainReadyChange: (isReady: boolean) => void;
  onTerrainSamplerChange: (sampler: TerrainSampler | null) => void;
}

interface WorldTerrainErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
  resetKey: string;
}

interface WorldTerrainErrorBoundaryState {
  hasError: boolean;
}

const raycastDirection = new Vector3(0, -1, 0);
const fallbackGroundNormal = new Vector3(0, 1, 0);
const terrainHsl = { h: 0, l: 0, s: 0 };
const terrainVertexColor = new Color();

function cloneTerrainMaterial(material: Material): Material {
  const clonedMaterial = material.clone();

  if (clonedMaterial instanceof MeshStandardMaterial) {
    clonedMaterial.roughness = Math.max(clonedMaterial.roughness, 0.88);
  }

  return clonedMaterial;
}

function softenWalkableVertexColors(mesh: Mesh): void {
  const colorAttribute = mesh.geometry.getAttribute("color");

  if (!colorAttribute) {
    return;
  }

  mesh.geometry = mesh.geometry.clone();
  const clonedColorAttribute = mesh.geometry.getAttribute("color");

  for (let index = 0; index < clonedColorAttribute.count; index += 1) {
    terrainVertexColor.setRGB(
      clonedColorAttribute.getX(index),
      clonedColorAttribute.getY(index),
      clonedColorAttribute.getZ(index),
    );
    terrainVertexColor.getHSL(terrainHsl);
    terrainVertexColor.setHSL(
      terrainHsl.h,
      terrainHsl.s * 0.68,
      Math.min(0.72, terrainHsl.l * 0.88 + 0.025),
    );
    clonedColorAttribute.setXYZ(
      index,
      terrainVertexColor.r,
      terrainVertexColor.g,
      terrainVertexColor.b,
    );
  }

  clonedColorAttribute.needsUpdate = true;
}

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

  componentDidUpdate(prevProps: WorldTerrainErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
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
  modelUrl = worldTerrain.modelUrl,
  onTerrainReadyChange,
  onTerrainSamplerChange,
}: IslandTerrainProps) {
  const gltf = useGLTF(modelUrl);
  const rootRef = useRef<Group>(null);
  const scene = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);

    clonedScene.traverse((object) => {
      if (object instanceof Mesh) {
        const isWalkableMesh =
          worldTerrain.walkableMeshNames.includes(
            object.name as (typeof worldTerrain.walkableMeshNames)[number],
          ) ||
          worldTerrain.walkableMeshNames.includes(
            object.geometry.name as (typeof worldTerrain.walkableMeshNames)[number],
          );

        object.material = Array.isArray(object.material)
          ? object.material.map(cloneTerrainMaterial)
          : cloneTerrainMaterial(object.material);

        if (isWalkableMesh) {
          softenWalkableVertexColors(object);
        }

        // Large walkable meshes self-shadow at grazing sun angles and create
        // visible acne bands. They only need to receive landmark shadows.
        object.castShadow = !isWalkableMesh;
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
      console.warn("Walkable terrain mesh was not found in the ground model.");
      onTerrainSamplerChange(null);
      onTerrainReadyChange(true);
      return undefined;
    }

    const sampler = createTerrainSampler(walkableMeshes);
    onTerrainSamplerChange(sampler);
    onTerrainReadyChange(true);

    return () => {
      onTerrainSamplerChange(null);
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
