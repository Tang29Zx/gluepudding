// ============================================================
// 周易桌 — 签筒交互
// 加载签筒 GLB，点击开始/停止晃动
// ============================================================

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Mesh, Raycaster, Vector2 } from "three";

// ---- draw lots data ----
interface LotResult {
  id: number;
  level: string;      // 签等
  tag: string;        // 短标签
  poem: string;       // 签文
  interpretation: string; // 解读
}

const LOTS: LotResult[] = [
  { id: 1, level: "上上签", tag: "龙腾四海", poem: "困龙得水好运交，不由喜气上眉梢。一切谋望皆如意，向后时运渐渐高。", interpretation: "大吉之兆。时来运转，如龙入海，前程似锦。诸事顺遂，宜积极进取。" },
  { id: 2, level: "上上签", tag: "金榜题名", poem: "十年寒窗无人问，一举成名天下知。春风得意马蹄疾，一日看尽长安花。", interpretation: "功名成就之象。多年努力终得回报，事业学业皆有突破。坚持初心，必有成果。" },
  { id: 3, level: "上签", tag: "枯木逢春", poem: "枯木逢春色欲华，顿然枝盛长萌芽。时人莫作为柴看，待得春深又吐花。", interpretation: "否极泰来之兆。看似无望之事将现转机，旧业重振，莫轻言放弃。" },
  { id: 4, level: "上签", tag: "顺水行舟", poem: "顺风行舟橹自轻，不须费力也堪行。前程自有通津处，安稳行船过洞庭。", interpretation: "一帆风顺之象。顺势而为，事半功倍。不要刻意强求，自然水到渠成。" },
  { id: 5, level: "上签", tag: "明月当空", poem: "明月当空处处光，何愁前路不昭彰。心中若有菩提树，自有祥云护四方。", interpretation: "光明在前。心中坦荡，则前路清晰。近期有好消息，贵人相助之象。" },
  { id: 6, level: "中签", tag: "脚踏实地", poem: "莫向空中觅楼阁，脚踏实地自为高。虽无功名成大器，平平安安乐逍遥。", interpretation: "安稳之象。不贪不妄，守本务实。平平淡淡是真福，急功近利反生波折。" },
  { id: 7, level: "中签", tag: "云开见日", poem: "云雾遮天日暂冥，忽然风起放光明。眼前虽有迷离处，不久晴空万里清。", interpretation: "迷雾将散。眼前困顿只是暂时的，保持耐心和信心，曙光不远。" },
  { id: 8, level: "中签", tag: "谨言慎行", poem: "是非只为多开口，烦恼皆因强出头。守得心田方寸地，自然安稳度春秋。", interpretation: "宜静不宜动。少说多做，避免卷入是非。守拙藏锋，待时而动。" },
  { id: 9, level: "中签", tag: "柳暗花明", poem: "山重水复疑无路，柳暗花明又一村。莫道眼前多险阻，转过弯来是坦途。", interpretation: "转机在即。看似困境，实则蕴藏机遇。换个角度看问题，会有新发现。" },
  { id: 10, level: "下签", tag: "逆水行舟", poem: "逆水行舟用力撑，一篙松劲退千寻。劝君莫作等闲看，事到临头要小心。", interpretation: "艰难之象。前路阻力较大，需加倍努力。谨防懈怠，一失足成千古恨。" },
  { id: 11, level: "下签", tag: "孤雁南飞", poem: "孤雁南飞影自怜，寒风瑟瑟夜难眠。莫将心事托流水，且待春来花满园。", interpretation: "孤独之象。暂时缺乏支持，需要独自面对困难。冬天终会过去，春天必将来临。" },
  { id: 12, level: "下下签", tag: "悬崖勒马", poem: "悬崖勒马收缰晚，船到江心补漏迟。莫待祸临方悔悟，早回头处是便宜。", interpretation: "警示之象。当前方向可能有误，须及时调整。亡羊补牢，为时未晚。" },
  { id: 13, level: "下下签", tag: "秋叶飘零", poem: "秋风扫落叶纷纷，霜打残花更不存。万事不由人计较，且将心绪寄黄昏。", interpretation: "低谷之象。运势暂时低迷，诸事不顺。但物极必反，守得云开见月明。" },
  { id: 14, level: "上签", tag: "梅开二度", poem: "雪里梅花开二度，暗香浮动月黄昏。莫嫌老圃秋容淡，犹有寒香晚节存。", interpretation: "再次绽放。二次机遇来临，比第一次更成熟稳重。珍惜眼前机会。" },
  { id: 15, level: "上上签", tag: "双喜临门", poem: "喜鹊檐前报好音，双喜临门福满庭。花好月圆人长寿，从今万事尽康宁。", interpretation: "极佳之兆。好事成双，家庭美满，事业顺利。可大胆行动，把握良机。" },
  { id: 16, level: "中签", tag: "静待时机", poem: "姜太公钓渭水滨，直钩不为鲤鱼新。耐心守得时运至，自有文王识玉珍。", interpretation: "等待良机。时机未到，不要急躁。充实自己，伯乐自会出现。" },
];

function drawLot(): LotResult {
  return LOTS[Math.floor(Math.random() * LOTS.length)];
}

const screenCenter = new Vector2(0, 0);

// from fortuneModelAssets: positionOnIchingTable(0, 1.14, 0) → [6, 1.14, 0]
const CYLINDER_POS: [number, number, number] = [6, 1.14, 0];
const CYLINDER_URL = "./models/fortune/iching_lot_cylinder.glb";
const FLOAT_Y = 0.5;
const BOUNCE_Y = 0.12;
const SHAKE_SPEED = 22;
const SHAKE_AMPLITUDE = 0.12;

export function IchingDesk() {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const raycasterRef = useRef(new Raycaster());
  const rayMeshRef = useRef<Mesh>(null!);
  const shakeGroupRef = useRef<Group>(null!);
  const timeRef = useRef(0);
  const hoveredRef = useRef(false);
  const prevShakingRef = useRef(false);

  // result overlay
  function showResultOverlay(lot: LotResult) {
    document.exitPointerLock();
    if (document.getElementById("iching-result-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "iching-result-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:999;background:rgba(0,0,0,0.55);cursor:default;";
    overlay.innerHTML = `<div style="background:#f7f5fb;border-radius:14px;padding:28px 32px;max-width:420px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
      <div style="font-size:15px;font-weight:500;color:#5d4db6;margin-bottom:12px;">抽签结果</div>
      <div style="font-size:28px;font-weight:500;color:#1a1436;margin-bottom:4px;">第${lot.id}签 · ${lot.level}</div>
      <div style="font-size:14px;color:#c9a84c;margin-bottom:16px;">${lot.tag}</div>
      <div style="font-size:16px;color:#333;line-height:2;margin-bottom:16px;padding:16px;background:#fff;border-radius:10px;border:1px solid #e8e4f2;">${lot.poem}</div>
      <div style="font-size:13px;color:#666;line-height:1.8;margin-bottom:16px;text-align:left;padding:0 4px;">${lot.interpretation}</div>
      <button id="iching-result-close" style="padding:8px 32px;border:none;border-radius:8px;background:#5d4db6;color:#fff;font-size:14px;cursor:pointer;font-weight:500;">关闭</button>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#iching-result-close")!.addEventListener("click", () => overlay.remove());
  }

  const [isShaking, setIsShaking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // shake sound effect
  useEffect(() => {
    if (isShaking) {
      const sfx = new Audio("/audio/shake_cylinder.wav");
      sfx.volume = 0.4;
      sfx.play().catch(() => {});
    }
  }, [isShaking]);

  // load the actual lot cylinder model
  const gltf = useGLTF(CYLINDER_URL);
  const modelScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  // raycasting
  useFrame(() => {
    raycasterRef.current.setFromCamera(screenCenter, camera);
    const hits = rayMeshRef.current
      ? raycasterRef.current.intersectObject(rayMeshRef.current, false)
      : [];
    const h = hits.length > 0;
    if (hoveredRef.current !== h) { hoveredRef.current = h; setIsHovered(h); }
  });

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
      const t = setTimeout(() => showResultOverlay(lot), 600);
      return () => clearTimeout(t);
    }
    prevShakingRef.current = isShaking;
  }, [isShaking]);

  // click
  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    if (document.pointerLockElement !== domElement) return;
    if (!hoveredRef.current) return;
    event.preventDefault(); event.stopPropagation();
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

      {/* raycast target (invisible overlay) */}
      <mesh ref={rayMeshRef}>
        <cylinderGeometry args={[0.14, 0.14, 0.75, 20]} />
        <meshStandardMaterial
          color={isShaking ? "#ffd977" : isHovered ? "#c9a84c" : "#5d4db6"}
          emissive={isShaking ? "#ffd977" : isHovered ? "#c9a84c" : "#5d4db6"}
          emissiveIntensity={isShaking ? 0.55 : isHovered ? 0.5 : 0.18}
          roughness={0.3}
          transparent
          opacity={isShaking ? 0.4 : isHovered ? 0.4 : 0.18}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
