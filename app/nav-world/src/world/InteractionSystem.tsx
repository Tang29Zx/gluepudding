import type { Vector3Tuple } from "./sceneConfig";

export interface InteractionTarget {
  id: string;
  label: string;
  position: Vector3Tuple;
  enabled: boolean;
}

export const layerOneInteractionTargets: readonly InteractionTarget[] = [];

export function InteractionSystem() {
  return null;
}
