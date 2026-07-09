import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import { Mesh, Raycaster, Vector2, Vector3 } from "three";
import type { PlayerControllerState } from "./PlayerController";
import {
  landmarkPositions,
  type Vector3Tuple,
} from "./sceneConfig";

export type InteractionTargetId =
  | "divination-house"
  | "laboratory"
  | "gomoku-board";

export type InteractionActivationMode = "area" | "object";

export interface ActiveInteractionPanel {
  mode: InteractionActivationMode;
  targetId: InteractionTargetId;
}

export interface InteractionTarget {
  id: InteractionTargetId;
  label: string;
  position: Vector3Tuple;
  aimPosition: Vector3Tuple;
  proximityRadius: number;
  raycastRadius: number;
  enabled: boolean;
  accentColor: string;
  areaPrompt: string;
  objectPrompt: string;
  panelTitle: string;
  panelBody: string;
}

interface InteractionSystemProps {
  isPanelOpen: boolean;
  isWorldControlAimed: boolean;
  player: PlayerControllerState;
  selectedTargetId: InteractionTargetId | null;
  onActivateArea: (targetId: InteractionTargetId) => void;
  onAimedTargetChange: (targetId: InteractionTargetId | null) => void;
  onNearestTargetChange: (targetId: InteractionTargetId | null) => void;
  onSelectObject: (targetId: InteractionTargetId) => void;
}

const screenCenter = new Vector2(0, 0);
const playerGroundPosition = new Vector3();
const [
  divinationHouseX,
  divinationHouseY,
  divinationHouseZ,
] = landmarkPositions.divinationHouse;
const [laboratoryX, laboratoryY, laboratoryZ] = landmarkPositions.laboratory;
const [gomokuBoardX, gomokuBoardY, gomokuBoardZ] = landmarkPositions.gomokuBoard;

export const interactionTargets: readonly InteractionTarget[] = [
  {
    id: "divination-house",
    label: "占卜屋",
    position: [divinationHouseX, divinationHouseY, divinationHouseZ + 3.84],
    aimPosition: [
      divinationHouseX,
      divinationHouseY + 2.35,
      divinationHouseZ + 3.84,
    ],
    proximityRadius: 12,
    raycastRadius: 4.2,
    enabled: true,
    accentColor: "#a99bea",
    areaPrompt: "靠近占卜屋，按 E 聚焦占卜屋常驻模块表面。",
    objectPrompt: "准星对准占卜屋入口，左键聚焦常驻模块表面。",
    panelTitle: "占卜屋模块外壳",
    panelBody:
      "Layer 4 验证模块外壳、状态切换和错误隔离。塔罗、星座和周易流程会在 Layer 5 接入。",
  },
  {
    id: "laboratory",
    label: "实验室",
    position: [laboratoryX, laboratoryY, laboratoryZ + 3.82],
    aimPosition: [laboratoryX, laboratoryY + 2.45, laboratoryZ + 3.82],
    proximityRadius: 13,
    raycastRadius: 4.6,
    enabled: true,
    accentColor: "#77aee8",
    areaPrompt: "靠近实验室，按 E 聚焦实验室常驻模块表面。",
    objectPrompt: "准星对准实验室大屏区域，左键聚焦常驻模块表面。",
    panelTitle: "实验室模块外壳",
    panelBody:
      "这里后续承载 WebRTC 大屏、RDK 展示台和门禁控制台。当前验证模块外壳和降级状态。",
  },
  {
    id: "gomoku-board",
    label: "五子棋",
    position: landmarkPositions.gomokuBoard,
    aimPosition: [gomokuBoardX, gomokuBoardY + 1.05, gomokuBoardZ],
    proximityRadius: 9.5,
    raycastRadius: 3.8,
    enabled: false,
    accentColor: "#ffd977",
    areaPrompt: "靠近五子棋区，按 E 聚焦五子棋常驻模块表面。",
    objectPrompt: "准星对准五子棋棋盘，左键聚焦常驻模块表面。",
    panelTitle: "五子棋模块外壳",
    panelBody:
      "Layer 4 验证棋局外壳在世界内打开。真正棋局面板和落子会在 Layer 7 实现。",
  },
];

export function getInteractionTargetById(
  targetId: InteractionTargetId | null,
): InteractionTarget | null {
  if (!targetId) {
    return null;
  }

  return interactionTargets.find((target) => target.id === targetId) ?? null;
}

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

function isAreaInteractionKey(event: KeyboardEvent): boolean {
  return event.code === "KeyE" || event.key.toLowerCase() === "e";
}

function findNearestTarget(
  position: Vector3,
): InteractionTargetId | null {
  let nearestTargetId: InteractionTargetId | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const target of interactionTargets) {
    if (!target.enabled) {
      continue;
    }

    const distance = Math.hypot(
      position.x - target.position[0],
      position.z - target.position[2],
    );

    if (distance <= target.proximityRadius && distance < nearestDistance) {
      nearestDistance = distance;
      nearestTargetId = target.id;
    }
  }

  return nearestTargetId;
}

function getTargetStateOpacity({
  isAimed,
  isNearest,
  isSelected,
}: {
  isAimed: boolean;
  isNearest: boolean;
  isSelected: boolean;
}): number {
  if (isSelected) {
    return 0.92;
  }

  if (isAimed) {
    return 0.74;
  }

  if (isNearest) {
    return 0.5;
  }

  return 0.18;
}

export function InteractionSystem({
  isPanelOpen,
  isWorldControlAimed,
  onActivateArea,
  onAimedTargetChange,
  onNearestTargetChange,
  onSelectObject,
  player,
  selectedTargetId,
}: InteractionSystemProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const aimedTargetIdRef = useRef<InteractionTargetId | null>(null);
  const nearestTargetIdRef = useRef<InteractionTargetId | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const targetMeshesRef = useRef<Partial<Record<InteractionTargetId, Mesh>>>({});

  const setNearestTargetId = useCallback(
    (targetId: InteractionTargetId | null) => {
      if (nearestTargetIdRef.current === targetId) {
        return;
      }

      nearestTargetIdRef.current = targetId;
      onNearestTargetChange(targetId);
    },
    [onNearestTargetChange],
  );

  const setAimedTargetId = useCallback(
    (targetId: InteractionTargetId | null) => {
      if (aimedTargetIdRef.current === targetId) {
        return;
      }

      aimedTargetIdRef.current = targetId;
      onAimedTargetChange(targetId);
    },
    [onAimedTargetChange],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isAreaInteractionKey(event) ||
        event.repeat ||
        isPanelOpen ||
        isWorldControlAimed ||
        isEditableElement(document.activeElement)
      ) {
        return;
      }

      const targetId = nearestTargetIdRef.current;

      if (!targetId) {
        return;
      }

      event.preventDefault();
      onActivateArea(targetId);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPanelOpen, isWorldControlAimed, onActivateArea]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        isPanelOpen ||
        isWorldControlAimed ||
        document.pointerLockElement !== domElement
      ) {
        return;
      }

      const targetId = aimedTargetIdRef.current;

      if (!targetId) {
        return;
      }

      event.preventDefault();
      onSelectObject(targetId);
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    domElement.addEventListener("click", handleClick);
    domElement.addEventListener("contextmenu", handleContextMenu);

    return () => {
      domElement.removeEventListener("click", handleClick);
      domElement.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [domElement, isPanelOpen, isWorldControlAimed, onSelectObject]);

  useFrame(() => {
    playerGroundPosition.set(
      player.position.current.x,
      player.position.current.y,
      player.position.current.z,
    );
    setNearestTargetId(findNearestTarget(playerGroundPosition));

    raycasterRef.current.setFromCamera(screenCenter, camera);

    const targetMeshes = interactionTargets
      .map((target) => targetMeshesRef.current[target.id])
      .filter((mesh): mesh is Mesh => Boolean(mesh));
    const intersections = raycasterRef.current.intersectObjects(targetMeshes, false);
    const aimedTarget = intersections
      .map((intersection) =>
        interactionTargets.find(
          (target) => targetMeshesRef.current[target.id] === intersection.object,
        ) ?? null,
      )
      .find((target): target is InteractionTarget => Boolean(target));

    setAimedTargetId(aimedTarget?.id ?? null);
  });

  return (
    <group>
      {interactionTargets.filter((target) => target.enabled).map((target) => {
        const isAimed = aimedTargetIdRef.current === target.id;
        const isNearest = nearestTargetIdRef.current === target.id;
        const isSelected = selectedTargetId === target.id;
        const opacity = getTargetStateOpacity({
          isAimed,
          isNearest,
          isSelected,
        });
        const ringScale = isSelected ? 1.12 : isAimed ? 1.06 : 1;
        const shouldShowAimMarker = target.id !== "divination-house";

        return (
          <group key={target.id}>
            <mesh
              position={[target.position[0], target.position[1] + 0.055, target.position[2]]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[ringScale, ringScale, ringScale]}
            >
              <torusGeometry args={[target.proximityRadius, 0.055, 12, 80]} />
              <meshBasicMaterial
                color={target.accentColor}
                opacity={opacity}
                transparent
              />
            </mesh>

            <mesh
              position={target.aimPosition}
              ref={(mesh) => {
                if (mesh) {
                  targetMeshesRef.current[target.id] = mesh;
                  return;
                }

                delete targetMeshesRef.current[target.id];
              }}
            >
              <sphereGeometry args={[target.raycastRadius, 18, 12]} />
              <meshBasicMaterial
                color={target.accentColor}
                depthWrite={false}
                opacity={0}
                transparent
              />
            </mesh>

            {shouldShowAimMarker ? (
              <mesh position={target.aimPosition}>
                <sphereGeometry args={[isSelected ? 0.42 : 0.32, 24, 16]} />
                <meshStandardMaterial
                  color={target.accentColor}
                  emissive={target.accentColor}
                  emissiveIntensity={isSelected || isAimed ? 0.54 : 0.2}
                  opacity={opacity}
                  transparent
                />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
