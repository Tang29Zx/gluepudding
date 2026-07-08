import type { InteractionTargetId } from "../world/InteractionSystem";
import type { Vector3Tuple } from "../world/sceneConfig";
import type {
  WorldModuleId,
  WorldModuleStatus,
} from "./types";

export interface WorldModuleDefinition {
  accentColor: string;
  capabilities: readonly string[];
  id: WorldModuleId;
  panelPosition: Vector3Tuple;
  panelRotation: Vector3Tuple;
  panelSize: readonly [number, number];
  statusCopy: Record<WorldModuleStatus, string>;
  subtitle: string;
  targetId: InteractionTargetId;
  title: string;
}

const targetToModuleId: Record<InteractionTargetId, WorldModuleId> = {
  "divination-house": "divination",
  laboratory: "laboratory",
  "gomoku-board": "gomoku",
};

const defaultWorldModuleStatuses = {
  divination: "ready",
  laboratory: "ready",
  gomoku: "ready",
} satisfies Record<WorldModuleId, WorldModuleStatus>;

const sharedStatusCopy = {
  error: "Local error boundary is active. The 3D world keeps running.",
  loading: "Controlled loading state for reproducible Layer 4 validation.",
  offline: "Offline placeholder. Real services are reserved for later layers.",
  ready: "Shell is ready. Business logic is intentionally not connected yet.",
} satisfies Record<WorldModuleStatus, string>;

export const worldModuleDefinitions = {
  divination: {
    accentColor: "#a99bea",
    capabilities: ["Zodiac shell", "Tarot table slot", "I Ching desk slot"],
    id: "divination",
    panelPosition: [0, 3.08, -29.78],
    panelRotation: [0, 0, 0],
    panelSize: [5.25, 2.85],
    statusCopy: sharedStatusCopy,
    subtitle: "Fortune room module surface",
    targetId: "divination-house",
    title: "Divination",
  },
  laboratory: {
    accentColor: "#77aee8",
    capabilities: ["WebRTC screen slot", "RDK model slot", "Door console slot"],
    id: "laboratory",
    panelPosition: [26, 3.05, -42.1],
    panelRotation: [0, 0, 0],
    panelSize: [5.65, 2.55],
    statusCopy: sharedStatusCopy,
    subtitle: "Laboratory module surface",
    targetId: "laboratory",
    title: "Laboratory",
  },
  gomoku: {
    accentColor: "#ffd977",
    capabilities: ["Board shell", "Move input slot", "Game state slot"],
    id: "gomoku",
    panelPosition: [-24, 1.85, -19.85],
    panelRotation: [-0.32, 0, 0],
    panelSize: [4.8, 2.55],
    statusCopy: sharedStatusCopy,
    subtitle: "Gomoku module surface",
    targetId: "gomoku-board",
    title: "Gomoku",
  },
} satisfies Record<WorldModuleId, WorldModuleDefinition>;

export const worldModuleDefinitionList = Object.values(worldModuleDefinitions);

export function createDefaultWorldModuleStatuses(): Record<
  WorldModuleId,
  WorldModuleStatus
> {
  return { ...defaultWorldModuleStatuses };
}

export function getWorldModuleById(
  moduleId: WorldModuleId,
): WorldModuleDefinition {
  return worldModuleDefinitions[moduleId];
}

export function getWorldModuleIdByTargetId(
  targetId: InteractionTargetId,
): WorldModuleId {
  return targetToModuleId[targetId];
}
