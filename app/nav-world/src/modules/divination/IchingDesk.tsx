// ============================================================
// 周易桌 — 签筒交互
// 加载签筒 GLB，点击开始/停止晃动
// ============================================================

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Mesh, MeshStandardMaterial, Raycaster, Vector2 } from "three";
import { staticAssetUrl } from "../../assets/staticAssetUrl";
import { consumeCanvasClick } from "./canvasEvents";
import { drawLot, type LotResult } from "./ichingLots";

const screenCenter = new Vector2(0, 0);

// from fortuneModelAssets: positionOnIchingTable(0, 1.14, 0) → [6, 1.14, 0]
const CYLINDER_POS: [number, number, number] = [6, 1.14, 0];
const CYLINDER_URL = staticAssetUrl("./models/fortune/iching_lot_cylinder.glb");
const BAMBOO_URL = staticAssetUrl("./models/fortune/iching_bamboo_slips.glb");
const FLOAT_Y = 0.5;
const BOUNCE_Y = 0.12;
const SHAKE_SPEED = 22;
const SHAKE_AMPLITUDE = 0.12;

export function IchingDesk({ onLotResult }: { onLotResult: (lot: LotResult) => void }) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const raycasterRef = useRef(new Raycaster());
  const shakeGroupRef = useRef<Group>(null!);
  const timeRef = useRef(0);
  const hoveredRef = useRef(false);
  const prevShakingRef = useRef(false);

  const [isShaking, setIsShaking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // load the actual lot cylinder model
  const gltf = useGLTF(CYLINDER_URL);
  const modelScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  // load bamboo slips
  const bambooGltf = useGLTF(BAMBOO_URL);
  const bambooScene = useMemo(() => bambooGltf.scene.clone(true), [bambooGltf.scene]);
  // bamboo slips — standing inside the cylinder
  const bambooLayout = useMemo(() => [
    { pos: [0.03, 0.4, 0.02], rotZ: 0.1, s: 1.1 },
    { pos: [-0.04, 0.42, -0.01], rotZ: 0.5, s: 1.0 },
    { pos: [0.01, 0.38, -0.04], rotZ: 0.9, s: 1.15 },
    { pos: [-0.02, 0.41, 0.04], rotZ: 1.3, s: 1.05 },
    { pos: [0.05, 0.39, 0.0], rotZ: 1.7, s: 1.1 },
    { pos: [-0.03, 0.43, -0.03], rotZ: 2.1, s: 0.95 },
    { pos: [0.0, 0.40, 0.03], rotZ: 2.5, s: 1.12 },
  ], []);
  // collect all meshes for surface highlight
  const cylinderMeshes = useRef<Mesh[]>([]);
  useMemo(() => {
    cylinderMeshes.current = [];
    modelScene.traverse((child) => {
      if ((child as Mesh).isMesh) cylinderMeshes.current.push(child as Mesh);
    });
  }, [modelScene]);

  // raycasting — use first mesh of the model itself
  useFrame(() => {
    raycasterRef.current.setFromCamera(screenCenter, camera);
    const target = cylinderMeshes.current.length > 0 ? cylinderMeshes.current : null;
    const hits = target
      ? raycasterRef.current.intersectObjects(target, false)
      : [];
    const h = hits.length > 0;
    if (hoveredRef.current !== h) { hoveredRef.current = h; setIsHovered(h); }
  });

  // surface highlight on hover/shake
  useEffect(() => {
    const emissive = isShaking ? "#ffd977" : isHovered ? "#c9a84c" : "#5d4db6";
    const intensity = isShaking ? 0.7 : isHovered ? 0.5 : 0.15;
    cylinderMeshes.current.forEach((m) => {
      const mat = m.material as MeshStandardMaterial;
      if (mat.emissive) mat.emissive.set(emissive);
      if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = intensity;
    });
  }, [isHovered, isShaking]);

  // shake + float animation
  useFrame((_, delta) => {
    if (!shakeGroupRef.current) return;
    const targetY = CYLINDER_POS[1] + (isShaking ? FLOAT_Y + Math.sin(timeRef.current * SHAKE_SPEED * 0.9) * BOUNCE_Y : 0);
    const curY = shakeGroupRef.current.position.y;
    shakeGroupRef.current.position.y = curY + (targetY - curY) * Math.min(delta * 8, 1);

    if (isShaking) {
      timeRef.current += delta;
      // base tilt + shake oscillation
      const tiltZ = 0.524; // 30°
      const tiltX = -0.06;
      shakeGroupRef.current.rotation.z = tiltZ + Math.sin(timeRef.current * SHAKE_SPEED) * SHAKE_AMPLITUDE;
      shakeGroupRef.current.rotation.x = tiltX + Math.cos(timeRef.current * SHAKE_SPEED * 1.3) * SHAKE_AMPLITUDE * 0.6;
    } else {
      shakeGroupRef.current.rotation.z *= 0.85;
      shakeGroupRef.current.rotation.x *= 0.85;
    }
  });

  // detect stop → show result
  useEffect(() => {
    if (prevShakingRef.current && !isShaking) {
      const lot = drawLot();
      const t = setTimeout(() => onLotResult(lot), 600);
      return () => clearTimeout(t);
    }
    prevShakingRef.current = isShaking;
  }, [isShaking, onLotResult]);

  // click
  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    if (document.pointerLockElement !== domElement) return;
    if (!hoveredRef.current) return;
    consumeCanvasClick(event);
    setIsShaking((prev) => !prev);
  }, [domElement]);

  useEffect(() => {
    domElement.addEventListener("click", handleClick);
    return () => domElement.removeEventListener("click", handleClick);
  }, [domElement, handleClick]);

  return (
    <group ref={shakeGroupRef} position={CYLINDER_POS}>
      {/* real lot cylinder model */}
      <primitive object={modelScene} scale={0.68} />
      {/* bamboo slips — standing upright inside the cylinder */}
      {bambooLayout.map((b, i) => (
        <primitive
          key={i}
          object={bambooScene.clone(true)}
          position={b.pos as [number, number, number]}
          rotation={[-Math.PI / 2, 0, b.rotZ]}
          scale={b.s}
        />
      ))}
    </group>
  );
}
