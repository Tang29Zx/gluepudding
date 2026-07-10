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
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import type { PlayerControllerState } from "../../world/PlayerController";
import { staticAssetUrl } from "../../assets/staticAssetUrl";
import {
  landmarkPositions,
  worldTerrain,
  type Vector3Tuple,
} from "../../world/sceneConfig";
import type { TerrainSampler } from "../../world/terrainSampler";
import {
  gomokuBoardConfig,
  gomokuBoardPlaySurfaceHeight,
  gomokuBoardSurfaceHeight,
  gomokuLocalToWorld,
  gomokuScreenCenterX,
  gomokuScreenSurfaceHeight,
  type GomokuAimTarget,
  type GomokuControlId,
  type GomokuPlacement,
  worldToGomokuLocal,
} from "./gomokuWorldTypes";
import {
  boardPointToGomokuLocal,
  getGomokuCoordName,
  getGomokuDifficultyLabel,
  getGomokuStoneLabel,
  gomokuLocalToBoardPoint,
  GOMOKU_BLACK,
  GOMOKU_GRID_CELL_SPACING,
  type GomokuGameState,
  type GomokuMove,
  type GomokuPoint,
} from "./gomokuGame";
import { useGomokuGame } from "./useGomokuGame";

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
  x: number;
  z: number;
}

const boardModelUrl = staticAssetUrl("./models/gomoku/gomoku_board.glb");
const blackStoneModelUrl = staticAssetUrl("./models/gomoku/black_stone.glb");
const whiteStoneModelUrl = staticAssetUrl("./models/gomoku/white_stone.glb");
const screenCenter = new Vector2(0, 0);
const placementDirection = new Vector3();
const placementForward = new Vector3();
const fallbackPlacementPoint = new Vector3();
const raycastTargetsScratch: Mesh[] = [];
const reservedAreaRadius = 7.2;
const controlScreenTextColor = "#283044";
const stoneSurfaceLift = 0.001;
const controlButtonWidth = 1.08;
const controlButtonDepth = 0.25;
const controlContentWidth = 1.14;
const boardVictoryGlowColor = "#f6d36f";
const boardVictoryGlowPlaneSize = gomokuBoardConfig.boardHalfSize * 2 + 0.68;
const boardVictoryGlowEdgeRatio =
  gomokuBoardConfig.boardHalfSize / (boardVictoryGlowPlaneSize / 2);

declare global {
  interface Window {
    __gomokuQa?: {
      activateControl: (controlId: GomokuControlId) => string;
      focusBoard: (view?: "close" | "far") => boolean;
      focusControlScreen: () => boolean;
      getState: () => {
        difficulty: string;
        history: readonly GomokuMove[];
        isOpen: boolean;
        status: string;
        winner: number | null;
      };
      playMove: (x: number, y: number) => boolean;
    };
  }
}

const gomokuControls: readonly GomokuControlDefinition[] = [
  {
    id: "undo",
    label: "悔棋",
    x: gomokuScreenCenterX,
    z: -0.24,
  },
  {
    id: "restart",
    label: "重开",
    x: gomokuScreenCenterX,
    z: 0.1,
  },
  {
    id: "difficulty",
    label: "AI 强度",
    x: gomokuScreenCenterX,
    z: 0.44,
  },
  {
    id: "retract",
    label: "收回棋盘",
    x: gomokuScreenCenterX,
    z: 0.78,
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

function cloneStoneScene(source: Group): Group {
  const scene = source.clone(true);

  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return scene;
}

function getBoardPointFromWorldPoint(
  placement: GomokuPlacement,
  point: Vector3,
): GomokuPoint | null {
  const local = worldToGomokuLocal(placement, point.x, point.z);

  return gomokuLocalToBoardPoint(local.x, local.z);
}

function getControlLabel(
  control: GomokuControlDefinition,
  gameState: GomokuGameState,
): string {
  if (control.id === "difficulty") {
    return getGomokuDifficultyLabel(gameState.difficulty);
  }

  if (control.id === "retract") {
    return "收回";
  }

  return control.label;
}

function getBoardAimLabel(
  placement: GomokuPlacement,
  point: Vector3 | null,
): string {
  if (!point) {
    return "五子棋棋盘";
  }

  const boardPoint = getBoardPointFromWorldPoint(placement, point);

  return boardPoint
    ? `落子点 ${getGomokuCoordName(boardPoint.x, boardPoint.y)}`
    : "五子棋棋盘";
}

function GomokuStoneModel({
  move,
  source,
}: {
  move: GomokuMove;
  source: Group;
}) {
  const scene = useMemo(() => cloneStoneScene(source), [source]);
  const local = boardPointToGomokuLocal(move);

  return (
    <group
      position={[local.x, gomokuBoardPlaySurfaceHeight + stoneSurfaceLift, local.z]}
      userData={{ qa: `gomoku-stone-${move.color}-${move.x}-${move.y}` }}
    >
      <primitive object={scene as Object3D} />
    </group>
  );
}

function WinLineMarker({ point }: { point: GomokuPoint }) {
  const local = boardPointToGomokuLocal(point);

  return (
    <mesh
      position={[local.x, gomokuBoardPlaySurfaceHeight + stoneSurfaceLift + 0.038, local.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <torusGeometry args={[GOMOKU_GRID_CELL_SPACING * 0.46, 0.008, 8, 24]} />
      <meshBasicMaterial color="#f6d36f" />
    </mesh>
  );
}

function setBasicMaterialOpacity(mesh: Mesh | null, opacity: number): void {
  const material = mesh?.material;

  if (material instanceof MeshBasicMaterial) {
    material.opacity = opacity;
  }
}

function createBoardVictoryGlowTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const size = 256;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;

  if (!context) {
    return null;
  }

  const imageData = context.createImageData(size, size);
  const data = imageData.data;
  const edgeWidth = 0.16;
  const [red, green, blue] = [246, 211, 111];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const normalizedX = Math.abs((x / (size - 1)) * 2 - 1);
      const normalizedY = Math.abs((y / (size - 1)) * 2 - 1);
      const distanceFromCenter = Math.max(normalizedX, normalizedY);
      const distanceFromBoardEdge = Math.abs(
        distanceFromCenter - boardVictoryGlowEdgeRatio,
      );
      const glow = Math.max(0, 1 - distanceFromBoardEdge / edgeWidth) ** 2;
      const index = (y * size + x) * 4;

      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = Math.round(glow * 255);
    }
  }

  context.putImageData(imageData, 0, 0);

  return new CanvasTexture(canvas);
}

function BoardVictoryGlow() {
  const meshRef = useRef<Mesh>(null);
  const texture = useMemo(() => createBoardVictoryGlowTexture(), []);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 3.2) + 1) / 2;
    const scale = 1 + pulse * 0.025;
    const mesh = meshRef.current;

    if (mesh) {
      mesh.scale.set(scale, scale, scale);
      setBasicMaterialOpacity(mesh, 0.5 + pulse * 0.22);
    }
  });

  if (!texture) {
    return null;
  }

  return (
    <mesh
      position={[
        0,
        gomokuBoardPlaySurfaceHeight + stoneSurfaceLift + 0.055,
        0,
      ]}
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      userData={{ qa: "gomoku-victory-board-glow" }}
    >
      <planeGeometry
        args={[boardVictoryGlowPlaneSize, boardVictoryGlowPlaneSize]}
      />
      <meshBasicMaterial
        blending={AdditiveBlending}
        color={boardVictoryGlowColor}
        depthWrite={false}
        map={texture}
        opacity={0.62}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
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
  displayLabel,
  isAimed,
  registerTargetMesh,
}: {
  control: GomokuControlDefinition;
  displayLabel: string;
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
        <boxGeometry args={[controlButtonWidth, 0.034, controlButtonDepth]} />
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
        fontSize={0.078}
        maxWidth={0.82}
        overflowWrap="break-word"
        position={[0, 0.026, 0.006]}
        rotation={[-Math.PI / 2, 0, 0]}
        textAlign="center"
      >
        {displayLabel}
      </Text>
    </group>
  );
}

export function GomokuBoardActivation({
  onHudMessageChange,
  onPlacementChange,
  placementTerrainSamplerRef,
  player,
}: Pick<
  GomokuWorldBoardProps,
  | "onHudMessageChange"
  | "onPlacementChange"
  | "placementTerrainSamplerRef"
  | "player"
>) {
  const camera = useThree((state) => state.camera);

  const openBoardFromView = useCallback(() => {
    const sampler = placementTerrainSamplerRef.current;
    camera.getWorldDirection(placementDirection);
    const target = getCandidateGroundPoint({
      cameraDirection: placementDirection,
      cameraPosition: camera.position,
      player,
      sampler,
    });
    const nextPlacement =
      findPlacementNearTarget({
        sampler,
        target,
        yaw: player.yaw.current,
      }) ??
      findPlacementNearTarget({
        sampler,
        target: getPlayerGroundPoint({ player, sampler }),
        yaw: player.yaw.current,
      });

    if (!nextPlacement) {
      onHudMessageChange("这里放不下棋盘，附近也没有找到合适空地。");
      return;
    }

    onPlacementChange(nextPlacement);
    onHudMessageChange("棋盘正在展开。加载完成后即可落子。");
  }, [
    camera,
    onHudMessageChange,
    onPlacementChange,
    placementTerrainSamplerRef,
    player,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.code !== "KeyG" ||
        isEditableElement(document.activeElement)
      ) {
        return;
      }

      event.preventDefault();
      openBoardFromView();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openBoardFromView]);

  return null;
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
  const blackStoneGltf = useGLTF(blackStoneModelUrl);
  const whiteStoneGltf = useGLTF(whiteStoneModelUrl);
  const boardScene = useMemo(() => cloneBoardScene(gltf.scene), [gltf.scene]);
  const aimedTargetRef = useRef<GomokuAimTarget | null>(null);
  const aimedBoardPointRef = useRef<Vector3 | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const targetMeshesRef = useRef(new Map<string, Mesh>());
  const targetsByMeshRef = useRef(new Map<string, GomokuAimTarget>());
  const game = useGomokuGame({ onMessage: onHudMessageChange });

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
        ? "棋盘已展开。左键交叉点落子，按 G 移动，按 H 收回。"
        : "棋盘已移动，当前棋局已保留。左键继续落子。",
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
      onHudMessageChange("棋盘已收回，当前棋局已保留。按 G 可重新展开。");
      return true;
    }

    if (target.kind === "control") {
      if (target.controlId === "undo") {
        onHudMessageChange(game.undo());
        return true;
      }

      if (target.controlId === "restart") {
        onHudMessageChange(game.restart());
        return true;
      }

      if (target.controlId === "difficulty") {
        onHudMessageChange(game.cycleDifficulty());
        return true;
      }

      return true;
    }

    if (target.kind === "board") {
      if (!placement || !aimedBoardPointRef.current) {
        onHudMessageChange("请对准棋盘交叉点落子。");
        return true;
      }

      const boardPoint = getBoardPointFromWorldPoint(
        placement,
        aimedBoardPointRef.current,
      );

      if (!boardPoint) {
        onHudMessageChange("请对准棋盘交叉点落子。");
        return true;
      }

      game.playPlayerMove(boardPoint);
      return true;
    }

    return false;
  }, [game, onHudMessageChange, onPlacementChange, placement]);

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
        onHudMessageChange("棋盘已收回，当前棋局已保留。按 G 可重新展开。");
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

    aimedBoardPointRef.current = null;
    setAimedTarget(null);
  }, [placement, setAimedTarget]);

  useEffect(() => {
    window.__gomokuQa = {
      activateControl(controlId) {
        if (controlId === "retract") {
          onPlacementChange(null);
          return "棋盘已收回，棋局已保留。";
        }

        if (controlId === "undo") {
          const message = game.undo();
          onHudMessageChange(message);
          return message;
        }

        if (controlId === "restart") {
          const message = game.restart();
          onHudMessageChange(message);
          return message;
        }

        const message = game.cycleDifficulty();
        onHudMessageChange(message);
        return message;
      },
      focusBoard(view = "close") {
        if (!placement) {
          return false;
        }

        const localCamera =
          view === "far"
            ? { x: 0, z: gomokuBoardConfig.boardHalfSize + 4.1 }
            : { x: 0.02, z: 0.52 };
        const localTarget = { x: 0.04, z: -0.08 };
        const cameraWorld = gomokuLocalToWorld(
          placement,
          localCamera.x,
          localCamera.z,
        );
        const targetWorld = gomokuLocalToWorld(
          placement,
          localTarget.x,
          localTarget.z,
        );
        const dx = targetWorld.x - cameraWorld.x;
        const dz = targetWorld.z - cameraWorld.z;

        player.clearMovement();
        player.position.current.set(
          cameraWorld.x,
          placement.center[1] + gomokuBoardSurfaceHeight,
          cameraWorld.z,
        );
        player.yaw.current = Math.atan2(-dx, -dz);
        player.pitch.current = view === "far" ? -0.42 : -1.31;

        return true;
      },
      focusControlScreen() {
        if (!placement) {
          return false;
        }

        const localCamera = {
          x: gomokuScreenCenterX,
          z: gomokuBoardConfig.screenDepth / 2 + 1.1,
        };
        const localTarget = {
          x: gomokuScreenCenterX,
          z: 0.05,
        };
        const cameraWorld = gomokuLocalToWorld(
          placement,
          localCamera.x,
          localCamera.z,
        );
        const targetWorld = gomokuLocalToWorld(
          placement,
          localTarget.x,
          localTarget.z,
        );
        const dx = targetWorld.x - cameraWorld.x;
        const dz = targetWorld.z - cameraWorld.z;

        player.clearMovement();
        player.position.current.set(
          cameraWorld.x,
          placement.center[1] + gomokuBoardSurfaceHeight,
          cameraWorld.z,
        );
        player.yaw.current = Math.atan2(-dx, -dz);
        player.pitch.current = -0.78;

        return true;
      },
      getState() {
        return {
          difficulty: game.state.difficulty,
          history: game.state.history,
          isOpen: Boolean(placement),
          status: game.state.status,
          winner: game.state.winner,
        };
      },
      playMove(x, y) {
        return game.playPlayerMove({ x, y });
      },
    };

    return () => {
      if (window.__gomokuQa?.getState().history === game.state.history) {
        delete window.__gomokuQa;
      }
    };
  }, [game, onHudMessageChange, onPlacementChange, placement, player]);

  useFrame(() => {
    if (!placement) {
      return;
    }

    raycasterRef.current.setFromCamera(screenCenter, camera);
    raycastTargetsScratch.length = 0;
    raycastTargetsScratch.push(...targetMeshesRef.current.values());

    const intersections =
      raycasterRef.current.intersectObjects(raycastTargetsScratch, false);
    let aimedTarget: GomokuAimTarget | null = null;
    aimedBoardPointRef.current = null;

    for (const intersection of intersections) {
      const target =
        targetsByMeshRef.current.get(intersection.object.uuid) ?? null;

      if (!target) {
        continue;
      }

      if (target.kind === "board") {
        aimedBoardPointRef.current = intersection.point.clone();
        aimedTarget = {
          kind: "board",
          label: getBoardAimLabel(placement, aimedBoardPointRef.current),
        };
      } else {
        aimedTarget = target;
      }

      break;
    }

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
  const detailLine =
    game.state.status === "terminal" && game.state.winner
      ? `${getGomokuStoneLabel(game.state.winner)}胜 · 点击重开再来一局`
      : game.statsText;

  return (
    <group
      position={placement.center}
      rotation={[0, placement.yaw, 0]}
      userData={{ qa: "gomoku-world-board" }}
    >
      <group position={[0, gomokuBoardConfig.boardVisualLift, 0]}>
        <primitive object={boardScene as Object3D} />
      </group>

      {game.state.history.map((move, index) => (
        <GomokuStoneModel
          key={`${index}-${move.x}-${move.y}-${move.color}`}
          move={move}
          source={
            move.color === GOMOKU_BLACK
              ? blackStoneGltf.scene
              : whiteStoneGltf.scene
          }
        />
      ))}

      {game.state.winLine.map((point) => (
        <WinLineMarker key={`${point.x}-${point.y}`} point={point} />
      ))}

      {game.state.status === "terminal" && game.state.winner ? (
        <BoardVictoryGlow />
      ) : null}

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
        <meshBasicMaterial depthWrite={false} transparent opacity={0} />
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
        <meshBasicMaterial depthWrite={false} transparent opacity={0} />
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

      <ControlText fontSize={0.09} maxWidth={controlContentWidth} x={gomokuScreenCenterX} z={-1.03}>
        五子棋
      </ControlText>
      <ControlText fontSize={0.058} maxWidth={controlContentWidth} x={gomokuScreenCenterX} z={-0.86}>
        {game.statusText}
      </ControlText>
      <ControlText fontSize={0.046} maxWidth={controlContentWidth} x={gomokuScreenCenterX} z={-0.71}>
        {`强度 ${getGomokuDifficultyLabel(game.state.difficulty)} · ${detailLine}`}
      </ControlText>

      {gomokuControls.map((control) => (
        <GomokuControlButton
          control={control}
          displayLabel={getControlLabel(control, game.state)}
          isAimed={
            aimedTarget?.kind === "control" &&
            aimedTarget.controlId === control.id
          }
          key={control.id}
          registerTargetMesh={registerTargetMesh}
        />
      ))}

    </group>
  );
}
