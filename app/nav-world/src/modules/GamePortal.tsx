import { Text } from "@react-three/drei";
import { landmarkPositions } from "../world/sceneConfig";

const [x, y, z] = landmarkPositions.gameRoom;

const DOOR_WIDTH = 2.4;
const DOOR_HEIGHT = 3.2;
const PILLAR_DEPTH = 0.3;
const PILLAR_WIDTH = 0.3;
const BEAM_HEIGHT = 0.25;

const pillarColor = "#8B8580";
const beamColor = "#7A7470";
const portalColor = "#4a90d9";

export function GamePortal() {
  const halfW = DOOR_WIDTH / 2;
  const pillarY = y + DOOR_HEIGHT / 2;
  const beamY = y + DOOR_HEIGHT;
  const portalY = y + DOOR_HEIGHT / 2;

  return (
    <group position={[x, y, z]}>
      {/* Left pillar */}
      <mesh castShadow position={[-halfW, pillarY, 0]}>
        <boxGeometry args={[PILLAR_WIDTH, DOOR_HEIGHT, PILLAR_DEPTH]} />
        <meshStandardMaterial color={pillarColor} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Right pillar */}
      <mesh castShadow position={[halfW, pillarY, 0]}>
        <boxGeometry args={[PILLAR_WIDTH, DOOR_HEIGHT, PILLAR_DEPTH]} />
        <meshStandardMaterial color={pillarColor} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Top beam */}
      <mesh castShadow position={[0, beamY, 0]}>
        <boxGeometry args={[DOOR_WIDTH + PILLAR_WIDTH, BEAM_HEIGHT, PILLAR_DEPTH]} />
        <meshStandardMaterial color={beamColor} roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Portal glow — semi-transparent shimmer inside the doorframe */}
      <mesh position={[0, portalY, -0.05]}>
        <planeGeometry args={[DOOR_WIDTH - PILLAR_WIDTH, DOOR_HEIGHT - BEAM_HEIGHT / 2]} />
        <meshStandardMaterial
          color={portalColor}
          emissive={portalColor}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.1}
          transparent
          opacity={0.25}
          side={2} // DoubleSide
        />
      </mesh>

      {/* Label */}
      <Text
        anchorX="center"
        anchorY="bottom"
        color="#ffffff"
        fontSize={0.22}
        maxWidth={3}
        position={[0, beamY + 0.4, 0]}
      >
        视角塑影师
      </Text>
      <Text
        anchorX="center"
        anchorY="bottom"
        color="#aaccff"
        fontSize={0.12}
        maxWidth={3}
        position={[0, beamY + 0.12, 0]}
      >
        按 E 进入
      </Text>

      {/* Small decorative pedestal / step at the base */}
      <mesh receiveShadow position={[0, 0.05, 0.15]}>
        <boxGeometry args={[DOOR_WIDTH + 0.4, 0.1, 0.5]} />
        <meshStandardMaterial color="#9E9892" roughness={0.8} metalness={0.05} />
      </mesh>
    </group>
  );
}
