import { useFrame } from "@react-three/fiber";
import { useState, type MutableRefObject } from "react";
import type { TerrainSampler } from "./terrainSampler";

interface WorldCompositionProps {
  isVisible: boolean;
  terrainSamplerRef: MutableRefObject<TerrainSampler | null>;
}

interface GroundedDecoration {
  id: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

interface CompositionLayout {
  gomokuMarker: GroundedDecoration;
  grass: GroundedDecoration[];
  hub: GroundedDecoration;
  lanterns: GroundedDecoration[];
  pathStones: GroundedDecoration[];
  rocks: GroundedDecoration[];
}

type GroundPoint = readonly [x: number, z: number];

const pathRoutes: readonly (readonly GroundPoint[])[] = [
  [
    [0, 39],
    [0, 31.5],
  ],
  [
    [0, 31.5],
    [-11.2, 26.1],
  ],
  [
    [0, 31.5],
    [10.7, 26.4],
  ],
  [
    [0, 31.5],
    [0, 24.8],
  ],
];

const rockPoints: readonly GroundPoint[] = [
  [-4.5, 36.1],
  [4.7, 35.3],
  [-6.7, 31.4],
  [7.2, 30.9],
  [-13.6, 29.1],
  [14.2, 29.4],
  [-3.2, 26.1],
  [4, 25.8],
];

const grassPoints: readonly GroundPoint[] = [
  [-2.8, 37.4],
  [3.1, 37],
  [-5.1, 34],
  [5.8, 33.6],
  [-8.2, 30.1],
  [9.1, 29.8],
  [-12.2, 30.6],
  [12.7, 31.2],
  [-5.4, 27.5],
  [5.3, 27.1],
  [-1.9, 25.4],
  [2.1, 25.2],
];

const lanternPoints: readonly GroundPoint[] = [
  [-3.7, 33.5],
  [4.1, 33.2],
  [-8.6, 28.9],
  [8.8, 28.9],
];

function samplePosition(
  sampler: TerrainSampler,
  point: GroundPoint,
  lift = 0.04,
): [number, number, number] | null {
  const [x, z] = point;
  const ground = sampler.sampleGround(x, z, 8);

  if (!ground) {
    return null;
  }

  return [x, ground.y + lift, z];
}

function createGroundedDecorations(
  sampler: TerrainSampler,
  points: readonly GroundPoint[],
  prefix: string,
  lift = 0.04,
): GroundedDecoration[] {
  return points.flatMap((point, index) => {
    const position = samplePosition(sampler, point, lift);

    if (!position) {
      return [];
    }

    return [{
      id: `${prefix}-${index}`,
      position,
      rotationY: ((index * 47) % 19) * 0.16,
      scale: 0.82 + (index % 4) * 0.11,
    }];
  });
}

function createPathStones(sampler: TerrainSampler): GroundedDecoration[] {
  const stones: GroundedDecoration[] = [];
  const seen = new Set<string>();

  pathRoutes.forEach(([start, end], routeIndex) => {
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(2, Math.ceil(distance / 1.05));
    const rotationY = Math.atan2(dx, dz);

    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const lateralOffset = ((step + routeIndex) % 2 === 0 ? -1 : 1) * 0.1;
      const x = start[0] + dx * progress + Math.cos(rotationY) * lateralOffset;
      const z = start[1] + dz * progress - Math.sin(rotationY) * lateralOffset;
      const key = `${x.toFixed(1)}:${z.toFixed(1)}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      const position = samplePosition(sampler, [x, z], 0.055);

      if (!position) {
        continue;
      }

      stones.push({
        id: `path-${routeIndex}-${step}`,
        position,
        rotationY: rotationY + ((step % 3) - 1) * 0.08,
        scale: 0.9 + (step % 4) * 0.055,
      });
    }
  });

  return stones;
}

function createCompositionLayout(sampler: TerrainSampler): CompositionLayout | null {
  const hubPosition = samplePosition(sampler, [0, 31.5], 0.065);
  const gomokuMarkerPosition = samplePosition(sampler, [0, 24.8], 0.045);

  if (!hubPosition || !gomokuMarkerPosition) {
    return null;
  }

  return {
    gomokuMarker: {
      id: "gomoku-marker",
      position: gomokuMarkerPosition,
      rotationY: Math.PI / 4,
      scale: 1,
    },
    grass: createGroundedDecorations(sampler, grassPoints, "grass", 0.02),
    hub: {
      id: "path-hub",
      position: hubPosition,
      rotationY: Math.PI / 4,
      scale: 1,
    },
    lanterns: createGroundedDecorations(sampler, lanternPoints, "lantern", 0),
    pathStones: createPathStones(sampler),
    rocks: createGroundedDecorations(sampler, rockPoints, "rock", 0.08),
  };
}

function PathStone({ decoration, index }: {
  decoration: GroundedDecoration;
  index: number;
}) {
  const pathColors = ["#a99470", "#b39d78", "#9d8c6d"] as const;

  return (
    <mesh
      position={decoration.position}
      receiveShadow
      rotation={[-Math.PI / 2, 0, decoration.rotationY]}
      scale={[decoration.scale * 1.28, decoration.scale * 0.78, 1]}
    >
      <circleGeometry args={[0.48, 8]} />
      <meshStandardMaterial
        color={pathColors[index % pathColors.length]}
        polygonOffset
        polygonOffsetFactor={-2}
        roughness={0.98}
      />
    </mesh>
  );
}

function Rock({ decoration, index }: {
  decoration: GroundedDecoration;
  index: number;
}) {
  const rockColors = ["#6f7368", "#7f7668", "#666c63"] as const;

  return (
    <mesh
      castShadow
      position={decoration.position}
      receiveShadow
      rotation={[0.12 * (index % 3), decoration.rotationY, -0.08 * (index % 2)]}
      scale={[
        decoration.scale * 0.72,
        decoration.scale * (0.44 + (index % 3) * 0.08),
        decoration.scale * 0.58,
      ]}
    >
      <dodecahedronGeometry args={[0.66, 0]} />
      <meshStandardMaterial color={rockColors[index % rockColors.length]} roughness={0.92} />
    </mesh>
  );
}

function GrassTuft({ decoration, index }: {
  decoration: GroundedDecoration;
  index: number;
}) {
  const colors = ["#557a50", "#66885a", "#496d4d"] as const;

  return (
    <group position={decoration.position} rotation={[0, decoration.rotationY, 0]}>
      {[-0.18, 0, 0.18].map((offset, bladeIndex) => (
        <mesh
          castShadow
          key={`${decoration.id}-blade-${bladeIndex}`}
          position={[offset, 0.22 + bladeIndex * 0.045, bladeIndex === 1 ? -0.04 : 0.03]}
          rotation={[0, bladeIndex * 0.68, (bladeIndex - 1) * 0.18]}
          scale={decoration.scale}
        >
          <coneGeometry args={[0.12, 0.52, 4]} />
          <meshStandardMaterial color={colors[(index + bladeIndex) % colors.length]} flatShading roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Lantern({ decoration }: { decoration: GroundedDecoration }) {
  return (
    <group position={decoration.position} rotation={[0, decoration.rotationY, 0]}>
      <mesh castShadow position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.055, 0.075, 1.28, 6]} />
        <meshStandardMaterial color="#433d3a" metalness={0.18} roughness={0.72} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color="#d7b56e"
          emissive="#c99a4d"
          emissiveIntensity={0.85}
          roughness={0.46}
        />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <coneGeometry args={[0.28, 0.22, 6]} />
        <meshStandardMaterial color="#55463b" roughness={0.72} />
      </mesh>
      <pointLight
        color="#f1b85f"
        decay={2}
        distance={5.5}
        intensity={5.5}
        position={[0, 1.35, 0]}
      />
    </group>
  );
}

export function WorldComposition({
  isVisible,
  terrainSamplerRef,
}: WorldCompositionProps) {
  const [layout, setLayout] = useState<CompositionLayout | null>(null);

  useFrame(() => {
    if (layout || !terrainSamplerRef.current) {
      return;
    }

    setLayout(createCompositionLayout(terrainSamplerRef.current));
  });

  if (!layout) {
    return null;
  }

  return (
    <group visible={isVisible}>
      {layout.pathStones.map((decoration, index) => (
        <PathStone decoration={decoration} index={index} key={decoration.id} />
      ))}
      <group position={layout.gomokuMarker.position}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.18, 12]} />
          <meshStandardMaterial
            color="#51483d"
            polygonOffset
            polygonOffsetFactor={-2}
            roughness={0.94}
          />
        </mesh>
        <gridHelper args={[1.72, 6, "#d5b76e", "#8d7d60"]} position={[0, 0.045, 0]} />
      </group>
      <mesh
        position={layout.hub.position}
        receiveShadow
        rotation={[-Math.PI / 2, 0, layout.hub.rotationY]}
      >
        <ringGeometry args={[0.72, 1.12, 8]} />
        <meshStandardMaterial
          color="#c7a665"
          polygonOffset
          polygonOffsetFactor={-2}
          roughness={0.9}
        />
      </mesh>
      {layout.rocks.map((decoration, index) => (
        <Rock decoration={decoration} index={index} key={decoration.id} />
      ))}
      {layout.grass.map((decoration, index) => (
        <GrassTuft decoration={decoration} index={index} key={decoration.id} />
      ))}
      {layout.lanterns.map((decoration) => (
        <Lantern decoration={decoration} key={decoration.id} />
      ))}
    </group>
  );
}
