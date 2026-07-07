import { InteractionSystem } from "./InteractionSystem";
import { landmarkPositions, worldColors, worldScale } from "./sceneConfig";

function DivinationHouse() {
  const [x, y, z] = landmarkPositions.divinationHouse;

  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[9.8, 0.2, 8.2]} />
        <meshStandardMaterial color="#d8c9ff" roughness={0.86} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.65, 0]}>
        <boxGeometry args={[7.2, 3.3, 5.8]} />
        <meshStandardMaterial color={worldColors.divination} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 4.05, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[5.2, 2.4, 4]} />
        <meshStandardMaterial color="#7c6fd3" roughness={0.74} />
      </mesh>
      <mesh position={[0, 1.05, 2.93]}>
        <boxGeometry args={[1.25, 2.1, 0.08]} />
        <meshStandardMaterial color="#6a5279" roughness={0.72} />
      </mesh>
      <mesh position={[-2.15, 2.05, 2.96]}>
        <boxGeometry args={[1.05, 0.85, 0.08]} />
        <meshStandardMaterial color="#efe8ff" emissive="#7c6fd3" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[2.15, 2.05, 2.96]}>
        <boxGeometry args={[1.05, 0.85, 0.08]} />
        <meshStandardMaterial color="#efe8ff" emissive="#7c6fd3" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

function LaboratoryBlock() {
  const [x, y, z] = landmarkPositions.laboratory;

  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[15, 0.24, 10]} />
        <meshStandardMaterial color="#c6e7f8" roughness={0.84} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[12, 4, 7.5]} />
        <meshStandardMaterial color={worldColors.lab} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 3.05, 3.82]}>
        <boxGeometry args={[5.6, 1.85, 0.12]} />
        <meshStandardMaterial color="#1f3445" emissive="#234b70" emissiveIntensity={0.28} />
      </mesh>
      <mesh position={[-4.2, 1.15, 3.86]}>
        <boxGeometry args={[1.35, 2.3, 0.1]} />
        <meshStandardMaterial color="#31546c" roughness={0.62} />
      </mesh>
    </group>
  );
}

function GomokuArea() {
  const [x, y, z] = landmarkPositions.gomokuBoard;

  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[10, 0.16, 10]} />
        <meshStandardMaterial color={worldColors.gomoku} roughness={0.8} />
      </mesh>
      <mesh receiveShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[7.2, 0.12, 7.2]} />
        <meshStandardMaterial color="#fff3bd" roughness={0.82} />
      </mesh>
    </group>
  );
}

function SpawnScaleMarker() {
  return (
    <group position={[-5.4, 0, -30.8]}>
      <mesh castShadow position={[0, 0.86, 0]}>
        <capsuleGeometry args={[0.32, 1.08, 12, 24]} />
        <meshStandardMaterial color={worldColors.player} roughness={0.62} />
      </mesh>
      <mesh castShadow position={[0, 1.84, 0]}>
        <sphereGeometry args={[0.24, 24, 16]} />
        <meshStandardMaterial color={worldColors.playerAccent} roughness={0.54} />
      </mesh>
    </group>
  );
}

function ReferenceLandmarks() {
  return (
    <group>
      <DivinationHouse />
      <LaboratoryBlock />
      <GomokuArea />
      <SpawnScaleMarker />
    </group>
  );
}

export function WorldScene() {
  return (
    <>
      <color attach="background" args={[worldColors.sky]} />
      <fog attach="fog" args={[worldColors.sky, 70, 150]} />
      <ambientLight intensity={0.76} />
      <hemisphereLight args={["#f8fdff", "#72a685", 0.92]} />
      <directionalLight
        castShadow
        intensity={2.6}
        position={[5.5, 8.2, 4.6]}
        shadow-mapSize={[1024, 1024]}
      />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[worldScale.groundRadius, 128]} />
        <meshStandardMaterial color={worldColors.ground} roughness={0.96} />
      </mesh>
      <gridHelper
        args={[worldScale.gridSize, worldScale.gridDivisions, "#4e8fd6", worldColors.grid]}
        position={[0, 0.012, 0]}
      />

      <ReferenceLandmarks />
      <InteractionSystem />
    </>
  );
}
