import { Text, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import {
  DoubleSide,
  Group,
  Mesh,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import type { PlayerControllerState } from "../../world/PlayerController";
import {
  landmarkPositions,
  worldTerrain,
  type Vector3Tuple,
} from "../../world/sceneConfig";
import type { TerrainSampler } from "../../world/terrainSampler";
import {
  gomokuBoardConfig,
  gomokuBoardSurfaceHeight,
  gomokuLocalToWorld,
  gomokuScreenCenterX,
  gomokuScreenSurfaceHeight,
  type GomokuAimTarget,
  type GomokuControlId,
  type GomokuPlacement,
} from "./gomokuWorldTypes";

interface GomokuWorldBoardProps {
  placement: GomokuPlacement | null;
  player: PlayerControllerState;
  placementTerrainSamplerRef: MutableRefObject<TerrainSampler | null>;
  onAimedTargetChange: (target: GomokuAimTarget | null) => void;
  onHudMessageChange: (message: string | null) => void;
  onPlacementChange: (placement: GomokuPlacement | null) => void;
}

interface GomokuControlDefinition {
  id: GomokuControlId;
  label: string;
  message: string;
  x: number;
  z: number;
}

type RegisteredTarget =
  | GomokuAimTarget
  | {
      kind: "screen";
      label: string;
    };

const boardModelUrl = "./models/gomoku/gomoku_board.glb";
const screenCenter = new Vector2(0, 0);
const placementDirection = new Vector3();
const placementForward = new Vector3();
const fallbackPlacementPoint = new Vector3();
const raycastTargetsScratch: Mesh[] = [];
const reservedAreaRadius = 7.2;
const controlScreenTextColor = "#283044";

const gomokuControls: readonly GomokuControlDefinition[] = [
  {
    id: "undo",
    label: "悔棋",
    message: "悔棋会在下一步接入真实棋局逻辑。",
    x: gomokuScreenCenterX,
    z: -0.48,
  },
  {
    id: "restart",
    label: "重开",
    message: "重开会在下一步接入真实棋局逻辑。",
    x: gomokuScreenCenterX,
    z: -0.08,
  },
  {
    id: "difficulty",
    label: "AI 强度",
    message: "AI 强度会在接入人机对战时生效。",
    x: gomokuScreenCenterX,
    z: 0.32,
  },
  {
    id: "retract",
    label: "收回棋盘",
    message: "棋盘已收回。",
    x: gomokuScreenCenterX,
    z: 0.72,
  },
];

const placementSamplePoints = [
  [0, 0],
  [-gomokuBoardConfig.boardHalfSize, -gomokuBoardConfig.boardHalfSize],
  [gomokuBoardConfig.boardHalfSize, -gomokuBoardConfig.boardHalfSize],
  [-gomokuBoardConfig.boardHalfSize, gomokuBoardConfig.boardHalfSize],
  [gomokuBoardConfig.boardHalfSize, gomokuBoardConfig.boardHalfSize],
  [
    gomokuScreenCenterX - gomokuBoardConfig.screenWidth / 2,
    -gomokuBoardConfig.screenDepth / 2,
  ],
  [
    gomokuScreenCenterX + gomokuBoardConfig.screenWidth / 2,
    -gomokuBoardConfig.screenDepth / 2,
  ],
  [
    gomokuScreenCenterX - gomokuBoardConfig.screenWidth / 2,
    gomokuBoardConfig.screenDepth / 2,
  ],
  [
    gomokuScreenCenterX + gomokuBoardConfig.screenWidth / 2,
    gomokuBoardConfig.screenDepth / 2,
  ],
] satisfies readonly (readonly [number, number])[];

const searchRings = [0, 1.2, 2.4, gomokuBoardConfig.placementSearchRadius] as const;

function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();

  return (
    element.isContentEditable ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "button"
  );
}

function cloneBoardScene(source: Group): Group {
  const scene = source.clone(true);

  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return scene;
}

function isReservedArea(x: number, z: number): boolean {
  const [divinationX, , divinationZ] = landmarkPositions.divinationHouse;
  const [laboratoryX, , laboratoryZ] = landmarkPositions.laboratory;

  return (
    Math.hypot(x - divinationX, z - divinationZ) < reservedAreaRadius ||
    Math.hypot(x - laboratoryX, z - laboratoryZ) < reservedAreaRadius
  );
}

function getCandidateGroundPoint({
  cameraDirection,
  cameraPosition,
  player,
  sampler,
}: {
  cameraDirection: Vector3;
  cameraPosition: Vector3;
  player: PlayerControllerState;
  sampler: TerrainSampler | null;
}): Vector3 | null {
  if (!sampler) {
    return null;
  }

  const camera = cameraPosition;
  placementDirection.copy(cameraDirection);

  let targetX = player.position.current.x;
  let targetZ = player.position.current.z;

  if (placementDirection.y < -0.05) {
    const t = (player.position.current.y - camera.y) / placementDirection.y;

    if (t > 1 && t < 32) {
      targetX = camera.x + placementDirection.x * t;
      targetZ = camera.z + placementDirection.z * t;
    }
  } else {
    placementForward
      .set(-Math.sin(player.yaw.current), 0, -Math.cos(player.yaw.current))
      .normalize();
    fallbackPlacementPoint
      .copy(player.position.current)
      .addScaledVector(placementForward, 5.5);
    targetX = fallbackPlacementPoint.x;
    targetZ = fallbackPlacementPoint.z;
  }

  const ground = sampler.sampleGround(targetX, targetZ);

  if (!ground || ground.normal.y < worldTerrain.minWalkableNormalY) {
    return null;
  }

  return new Vector3(targetX, ground.y, targetZ);
}

function getPlayerGroundPoint({
  player,
  sampler,
}: {
  player: PlayerControllerState;
  sampler: TerrainSampler | null;
}): Vector3 | null {
  if (!sampler) {
    return null;
  }

  const ground = sampler.sampleGround(
    player.position.current.x,
    player.position.current.z,
  );

  if (!ground || ground.normal.y < worldTerrain.minWalkableNormalY) {
    return null;
  }

  return new Vector3(
    player.position.current.x,
    ground.y,
    player.position.current.z,
  );
}

function createPlacementCandidate({
  sampler,
  targetX,
  targetZ,
  yaw,
}: {
  sampler: TerrainSampler;
  targetX: number;
  targetZ: number;
  yaw: number;
}): GomokuPlacement | null {
  const samples: number[] = [];
  const provisionalPlacement: GomokuPlacement = {
    center: [targetX, 0, targetZ],
    yaw,
  };

  for (const [localX, localZ] of placementSamplePoints) {
    const worldPoint = gomokuLocalToWorld(provisionalPlacement, localX, localZ);

    if (isReservedArea(worldPoint.x, worldPoint.z)) {
      return null;
    }

    const sample = sampler.sampleGround(worldPoint.x, worldPoint.z);

    if (!sample || sample.normal.y < worldTerrain.minWalkableNormalY) {
      return null;
    }

    samples.push(sample.y);
  }

  const minY = Math.min(...samples);
  const maxY = Math.max(...samples);

  if (maxY - minY > gomokuBoardConfig.maxPlacementHeightDelta) {
    return null;
  }

  return {
    center: [targetX, maxY + 0.012, targetZ],
    yaw,
  };
}

function findPlacementNearTarget({
  sampler,
  target,
  yaw,
}: {
  sampler: TerrainSampler | null;
  target: Vector3 | null;
  yaw: number;
}): GomokuPlacement | null {
  if (!sampler || !target) {
    return null;
  }

  for (const radius of searchRings) {
    const steps = radius === 0 ? 1 : 12;

    for (let index = 0; index < steps; index += 1) {
      const angle = (Math.PI * 2 * index) / steps;
      const targetX = target.x + Math.cos(angle) * radius;
      const targetZ = target.z + Math.sin(angle) * radius;
      const candidate = createPlacementCandidate({
        sampler,
        targetX,
        targetZ,
        yaw,
      });

      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function ControlText({
  children,
  fontSize,
  maxWidth,
  x,
  z,
}: {
  children: string;
  fontSize: number;
  maxWidth: number;
  x: number;
  z: number;
}) {
  return (
    <Text
      anchorX="center"
      anchorY="middle"
      color={controlScreenTextColor}
      fontSize={fontSize}
      maxWidth={maxWidth}
      overflowWrap="break-word"
      position={[x, gomokuScreenSurfaceHeight + 0.035, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      textAlign="center"
    >
      {children}
    </Text>
  );
}

function GomokuControlButton({
  control,
  isAimed,
  registerTargetMesh,
}: {
  control: GomokuControlDefinition;
  isAimed: boolean;
  registerTargetMesh: (mesh: Mesh | null, target: GomokuAimTarget) => void;
}) {
  const target: GomokuAimTarget = {
    controlId: control.id,
    kind: "control",
    label: control.label,
  };

  return (
    <group position={[control.x, gomokuScreenSurfaceHeight + 0.026, control.z]}>
      <mesh ref={(mesh) => registerTargetMesh(mesh, target)}>
        <boxGeometry args={[1.28, 0.034, 0.32]} />
        <meshStandardMaterial
          color={isAimed ? "#f6d36f" : "#dbe7f3"}
          emissive={isAimed ? "#f6d36f" : "#c7d8ec"}
          emissiveIntensity={isAimed ? 0.22 : 0.08}
          metalness={0.08}
          roughness={0.48}
        />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color={controlScreenTextColor}
        fontSize={0.115}
        maxWidth={1.08}
        overflowWrap="break-word"
        position={[0, 0.026, 0.006]}
        rotation={[-Math.PI / 2, 0, 0]}
        textAlign="center"
      >
        {control.label}
      </Text>
    </group>
  );
}

export function GomokuWorldBoard({
  onAimedTargetChange,
  onHudMessageChange,
  onPlacementChange,
  placement,
  placementTerrainSamplerRef,
  player,
}: GomokuWorldBoardProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const gltf = useGLTF(boardModelUrl);
  const boardScene = useMemo(() => cloneBoardScene(gltf.scene), [gltf.scene]);
  const aimedTargetRef = useRef<GomokuAimTarget | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const targetMeshesRef = useRef(new Map<string, Mesh>());
  const targetsByMeshRef = useRef(new Map<string, GomokuAimTarget>());

  const setAimedTarget = useCallback(
    (target: GomokuAimTarget | null) => {
      const current = aimedTargetRef.current;
      const isSame =
        current?.kind === target?.kind &&
        current?.label === target?.label &&
        (current?.kind !== "control" ||
          target?.kind !== "control" ||
          current.controlId === target.controlId);

      if (isSame) {
        return;
      }

      aimedTargetRef.current = target;
      onAimedTargetChange(target);
    },
    [onAimedTargetChange],
  );

  const registerTargetMesh = useCallback((
    mesh: Mesh | null,
    target: GomokuAimTarget,
  ) => {
    const key =
      target.kind === "control" ? `control:${target.controlId}` : target.kind;

    if (!mesh) {
      const previousMesh = targetMeshesRef.current.get(key);

      if (previousMesh) {
        targetsByMeshRef.current.delete(previousMesh.uuid);
      }

      targetMeshesRef.current.delete(key);
      return;
    }

    targetMeshesRef.current.set(key, mesh);
    targetsByMeshRef.current.set(mesh.uuid, target);
  }, []);

  const placeBoardFromView = useCallback((action: "open" | "move") => {
    const sampler = placementTerrainSamplerRef.current;
    camera.getWorldDirection(placementDirection);
    const target = getCandidateGroundPoint({
      cameraDirection: placementDirection,
      cameraPosition: camera.position,
      player,
      sampler,
    });
    const nextPlacement = findPlacementNearTarget({
      sampler,
      target,
      yaw: player.yaw.current,
    }) ?? findPlacementNearTarget({
      sampler,
      target: getPlayerGroundPoint({ player, sampler }),
      yaw: player.yaw.current,
    });

    if (!nextPlacement) {
      onHudMessageChange("这里放不下棋盘，附近也没有找到合适空地。");
      return;
    }

    onPlacementChange(nextPlacement);
    onHudMessageChange(
      action === "open"
        ? "棋盘已展开。按 G 可移动位置，按 H 可收回。"
        : "棋盘已移动到新的可踩位置。按 H 可收回。",
    );
  }, [
    camera.position,
    onHudMessageChange,
    onPlacementChange,
    placementTerrainSamplerRef,
    player,
  ]);

  const activateControl = useCallback((target: GomokuAimTarget | null) => {
    if (!target) {
      return false;
    }

    if (target.kind === "control" && target.controlId === "retract") {
      onPlacementChange(null);
      onHudMessageChange("棋盘已收回。按 G 可重新展开。");
      return true;
    }

    if (target.kind === "control") {
      const control = gomokuControls.find((item) => item.id === target.controlId);
      onHudMessageChange(control?.message ?? "该控件会在下一步接入真实逻辑。");
      return true;
    }

    if (target.kind === "board") {
      onHudMessageChange("落子逻辑下一步接入；本轮先验证棋盘展开和控制屏。");
      return true;
    }

    return false;
  }, [onHudMessageChange, onPlacementChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        (event.code !== "KeyG" && event.code !== "KeyH") ||
        isEditableElement(document.activeElement)
      ) {
        return;
      }

      event.preventDefault();

      if (event.code === "KeyH") {
        if (!placement) {
          onHudMessageChange("当前没有展开的棋盘。按 G 可展开。");
          return;
        }

        onPlacementChange(null);
        onHudMessageChange("棋盘已收回。按 G 可重新展开。");
        return;
      }

      placeBoardFromView(placement ? "move" : "open");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onHudMessageChange, onPlacementChange, placeBoardFromView, placement]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || document.pointerLockElement !== domElement) {
        return;
      }

      if (!activateControl(aimedTargetRef.current)) {
        return;
      }

      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        (event.code !== "KeyE" && event.key.toLowerCase() !== "e") ||
        !activateControl(aimedTargetRef.current)
      ) {
        return;
      }

      event.preventDefault();
    };

    domElement.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      domElement.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activateControl, domElement]);

  useEffect(() => {
    if (placement) {
      return;
    }

    setAimedTarget(null);
  }, [placement, setAimedTarget]);

  useFrame(() => {
    if (!placement) {
      return;
    }

    raycasterRef.current.setFromCamera(screenCenter, camera);
    raycastTargetsScratch.length = 0;
    raycastTargetsScratch.push(...targetMeshesRef.current.values());

    const intersections =
      raycasterRef.current.intersectObjects(raycastTargetsScratch, false);
    const aimedTarget =
      intersections
        .map((intersection) =>
          targetsByMeshRef.current.get(intersection.object.uuid) ?? null,
        )
        .find((target): target is GomokuAimTarget => Boolean(target)) ?? null;

    setAimedTarget(aimedTarget);
  });

  if (!placement) {
    return null;
  }

  const aimedTarget = aimedTargetRef.current;
  const boardTarget: GomokuAimTarget = {
    kind: "board",
    label: "五子棋棋盘",
  };
  const screenTarget: GomokuAimTarget = {
    kind: "screen",
    label: "五子棋控制屏",
  };

  return (
    <group
      position={placement.center}
      rotation={[0, placement.yaw, 0]}
      userData={{ qa: "gomoku-world-board" }}
    >
      <group position={[0, gomokuBoardConfig.boardVisualLift, 0]}>
        <primitive object={boardScene as Object3D} />
      </group>

      <mesh
        ref={(mesh) => registerTargetMesh(mesh, boardTarget)}
        position={[0, gomokuBoardSurfaceHeight + 0.02, 0]}
      >
        <boxGeometry
          args={[
            gomokuBoardConfig.boardHalfSize * 2,
            0.04,
            gomokuBoardConfig.boardHalfSize * 2,
          ]}
        />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <mesh
        receiveShadow
        position={[
          gomokuScreenCenterX,
          gomokuScreenSurfaceHeight - gomokuBoardConfig.screenThickness / 2,
          0,
        ]}
      >
        <boxGeometry
          args={[
            gomokuBoardConfig.screenWidth,
            gomokuBoardConfig.screenThickness,
            gomokuBoardConfig.screenDepth,
          ]}
        />
        <meshStandardMaterial
          color="#e9edf5"
          emissive="#d5e1f2"
          emissiveIntensity={0.14}
          metalness={0.04}
          roughness={0.52}
        />
      </mesh>

      <mesh
        ref={(mesh) => registerTargetMesh(mesh, screenTarget)}
        position={[gomokuScreenCenterX, gomokuScreenSurfaceHeight + 0.018, 0]}
      >
        <boxGeometry
          args={[
            gomokuBoardConfig.screenWidth,
            0.036,
            gomokuBoardConfig.screenDepth,
          ]}
        />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <mesh
        position={[gomokuScreenCenterX, gomokuScreenSurfaceHeight + 0.004, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[
            gomokuBoardConfig.screenWidth - 0.14,
            gomokuBoardConfig.screenDepth - 0.14,
          ]}
        />
        <meshBasicMaterial
          color="#f6f2df"
          opacity={0.92}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <ControlText fontSize={0.132} maxWidth={1.38} x={gomokuScreenCenterX} z={-1.2}>
        五子棋控制屏
      </ControlText>
      <ControlText fontSize={0.072} maxWidth={1.38} x={gomokuScreenCenterX} z={-0.94}>
        G 展开 / 移动，H 收回，真实棋局下一步接入
      </ControlText>

      {gomokuControls.map((control) => (
        <GomokuControlButton
          control={control}
          isAimed={
            aimedTarget?.kind === "control" &&
            aimedTarget.controlId === control.id
          }
          key={control.id}
          registerTargetMesh={registerTargetMesh}
        />
      ))}

      <mesh
        position={[gomokuScreenCenterX, gomokuScreenSurfaceHeight + 0.015, 1.22]}
      >
        <boxGeometry args={[1.38, 0.018, 0.34]} />
        <meshStandardMaterial
          color="#d6e2ef"
          emissive="#c4d5e8"
          emissiveIntensity={0.08}
          roughness={0.56}
        />
      </mesh>
      <ControlText fontSize={0.064} maxWidth={1.2} x={gomokuScreenCenterX} z={1.23}>
        控制屏与棋盘平行，可踩可通过
      </ControlText>
    </group>
  );
}

useGLTF.preload(boardModelUrl);
