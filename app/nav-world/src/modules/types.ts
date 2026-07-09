export const worldModuleStatuses = [
  "ready",
  "loading",
  "offline",
  "error",
] as const;

export type WorldModuleStatus = (typeof worldModuleStatuses)[number];

export type WorldModuleId = "divination" | "laboratory" | "gomoku" | "game";

export type WorldModuleControlId =
  `${WorldModuleId}:status:${WorldModuleStatus}`;

export interface AimedWorldModuleControl {
  actionId: WorldModuleControlId;
  label: string;
  moduleId: WorldModuleId;
  moduleTitle: string;
  status: WorldModuleStatus;
}
