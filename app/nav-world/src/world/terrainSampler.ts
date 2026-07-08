import type { Vector3 } from "three";

export interface TerrainSample {
  normal: Vector3;
  y: number;
}

export interface TerrainSampler {
  sampleGround: (x: number, z: number) => TerrainSample | null;
}
