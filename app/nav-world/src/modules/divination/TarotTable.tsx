// ============================================================
// 塔罗桌 — 3D 交互组件
// 流程：点击水晶球 → 输入问题 → 22张牌弧形选牌(上浮) → 翻面(牌面图片)
// ============================================================

import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  Raycaster,
  Texture,
  Vector2,
} from "three";
import { getTarotReading } from "./fortuneApi";
import type { TarotResult } from "./types";
import {
  canSelectCard,
  deselectCard,
  MAJOR_LABELS,
  selectCard,
} from "./business/tarotLogic";

const screenCenter = new Vector2(0, 0);

// ---- crystal ball ----
const CRYSTAL_POS: [number, number, number] = [0, 1.42, 3.72];
const CRYSTAL_RAYCAST_R = 0.42;

// ---- content screen ----
const SCREEN_POS: [number, number, number] = [0, 2.0, 5.85];
const SCREEN_ROT: [number, number, number] = [0, Math.PI, 0];
const SCREEN_W = 3.6;
const SCREEN_H = 2.25;
const CANVAS_W = 768;
const CANVAS_H = 480;

// ---- card arc ----
const CARD_COUNT = 22;
const CARD_W = 0.35;
const CARD_H = 0.55;
const ARC_CENTER: [number, number, number] = [0, 1.55, 1.5];
const ARC_RADIUS = 3.0;
const ARC_START_DEG = -65;
const ARC_END_DEG = 65;
const MAX_SELECT = 3;
const FLOAT_Y = 0.32;
const FLIP_DURATION = 1.2;

// ---- card face filename mapping ----
const CARD_SLUGS = [
  "fool", "magician", "high_priestess", "empress", "emperor",
  "hierophant", "lovers", "chariot", "strength", "hermit",
  "wheel_of_fortune", "justice", "hanged_man", "death", "temperance",
  "devil", "tower", "star", "moon", "sun", "judgement", "world",
];

function cardFaceUrl(index: number): string {
  const s = String(index).padStart(2, "0");
  const slug = CARD_SLUGS[index] || "fool";
  return `/textures/tarot/major_${s}_${slug}.jpg`;
}

// ---- helpers ----

function cardPosition(index: number): [number, number, number] {
  const deg = ARC_START_DEG + (ARC_END_DEG - ARC_START_DEG) * (index / (CARD_COUNT - 1));
  const rad = (deg * Math.PI) / 180;
  return [
    ARC_CENTER[0] + ARC_RADIUS * Math.sin(rad),
    ARC_CENTER[1],
    ARC_CENTER[2] + ARC_RADIUS * Math.cos(rad),
  ];
}

function cardYaw(pos: [number, number, number]): number {
  return Math.atan2(-pos[0], -pos[2]);
}

function createScreenCanvas(): { canvas: HTMLCanvasElement; texture: CanvasTexture } {
  const c = document.createElement("canvas");
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  const t = new CanvasTexture(c);
  t.minFilter = 1006;
  t.magFilter = 1006;
  return { canvas: c, texture: t };
}

function createCardBackCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 140;
  c.height = 220;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1a1436";
  ctx.fillRect(0, 0, 140, 220);
  ctx.strokeStyle = "#c9a84c";
  ctx.lineWidth = 2.5;
  ctx.roundRect(5, 5, 130, 210, 7);
  ctx.stroke();
  ctx.strokeStyle = "#7c6fd3";
  ctx.lineWidth = 1;
  ctx.roundRect(11, 11, 118, 198, 5);
  ctx.stroke();
  ctx.fillStyle = "#c9a84c";
  ctx.beginPath();
  ctx.roundRect(20, 14, 100, 192, 4);
  ctx.strokeStyle = "#5d4db6";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // star
  ctx.fillStyle = "#c9a84c";
  ctx.font = "38px serif";
  ctx.textAlign = "center";
  ctx.fillText("\u2605", 70, 72);
  // text
  ctx.font = "16px serif";
  ctx.fillText("TAROT", 70, 124);
  // cross pattern
  ctx.fillStyle = "#c9a84c";
  ctx.font = "24px serif";
  ctx.fillText("\u2726", 70, 155);
  return c;
}

// ---- screen drawing helpers ----

function drawIdle(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_W, h = CANVAS_H, topH = h * 0.1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f8f7ff"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2a2048"; ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${Math.round(h * 0.04)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("塔罗占卜", w / 2, topH * 0.66);
  ctx.fillStyle = "#999";
  ctx.font = `${Math.round(h * 0.035)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("对准水晶球开始占卜", w / 2, h * 0.35);
}

function drawLoading(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_W, h = CANVAS_H, topH = h * 0.1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f8f7ff"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2a2048"; ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${Math.round(h * 0.04)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("塔罗占卜", w / 2, topH * 0.66);
  ctx.fillStyle = "#888";
  ctx.font = `${Math.round(h * 0.035)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("牌灵正在解读命运...", w / 2, h * 0.52);
}

function drawResult(ctx: CanvasRenderingContext2D, result: TarotResult): void {
  const w = CANVAS_W, h = CANVAS_H, topH = h * 0.1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f8f7ff"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2a2048"; ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 ${Math.round(h * 0.04)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("塔罗占卜结果", w / 2, topH * 0.66);

  const colW = w / (result.cards.length + 0.5);
  const cardStartY = h * 0.14;
  const cardH = h * 0.62;

  result.cards.forEach((card, ci) => {
    const cx = colW * (ci + 0.75);
    const posLabel = card.position === "past" ? "过去" : card.position === "present" ? "现在" : card.position === "future" ? "未来" : "核心";
    ctx.fillStyle = "#5d4db6";
    ctx.font = `500 ${Math.round(h * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(posLabel, cx, cardStartY + h * 0.018);
    ctx.fillStyle = "#444";
    ctx.font = `500 ${Math.round(h * 0.028)}px sans-serif`;
    ctx.fillText(card.name, cx, cardStartY + h * 0.06);
    ctx.fillStyle = card.isUpright ? "#2e7d32" : "#c62828";
    ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
    ctx.fillText(card.isUpright ? "正位" : "逆位", cx, cardStartY + h * 0.09);
    const kwY = cardStartY + h * 0.13;
    card.keywords.slice(0, 3).forEach((kw, ki) => {
      ctx.fillStyle = "#7c6fd3";
      ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
      ctx.fillText(kw, cx, kwY + ki * h * 0.035);
    });
    ctx.fillStyle = "#666";
    ctx.font = `${Math.round(h * 0.021)}px sans-serif`;
    const words = card.meaning;
    const maxChars = 10;
    for (let i = 0; i < words.length; i += maxChars) {
      ctx.fillText(words.slice(i, i + maxChars), cx, cardStartY + h * 0.3 + (i / maxChars) * h * 0.04);
    }
  });

  const summaryY = cardStartY + cardH + h * 0.02;
  ctx.fillStyle = "#888";
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.textAlign = "center";
  const maxChars = 40;
  for (let i = 0; i < result.summary.length; i += maxChars) {
    ctx.fillText(result.summary.slice(i, i + maxChars), w / 2, summaryY + (i / maxChars) * h * 0.04);
  }
}

// ---- selection progress HUD ----
function SelectionProgress({ count }: { count: number }) {
  if (count === 0) return <group />;
  const y = ARC_CENTER[1] + 0.85;
  const labels = ["过去", "现在", "未来"];
  return (
    <group position={[0, y, ARC_CENTER[2] + ARC_RADIUS * 0.2]}>
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <mesh position={[(i - 1) * 0.42, 0, 0]}>
            <planeGeometry args={[0.3, 0.1]} />
            <meshBasicMaterial color={i < count ? "#c9a84c" : "#444"} side={DoubleSide} transparent opacity={i < count ? 0.9 : 0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---- input overlay ----
function showQuestionOverlay(onConfirm: (q: string) => void, onCancel: () => void) {
  if (document.getElementById("tarot-question-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "tarot-question-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:999;background:rgba(0,0,0,0.55);cursor:default;";
  overlay.innerHTML = `<div style="background:#f8f7ff;border-radius:12px;padding:24px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.3);"><div style="font-size:18px;font-weight:500;color:#2a2048;margin-bottom:8px;">你想问什么？</div><div style="font-size:13px;color:#888;margin-bottom:16px;">默念你的问题，然后输入关键词</div><input id="tarot-question-input" type="text" placeholder="例如：我的感情发展如何？" style="width:100%;padding:10px 12px;border:1px solid #d3d1c7;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:16px;" autofocus /><div style="display:flex;gap:12px;justify-content:center;"><button id="tarot-question-cancel" style="padding:8px 24px;border:1px solid #d3d1c7;border-radius:8px;background:#fff;color:#666;font-size:14px;cursor:pointer;">取消</button><button id="tarot-question-confirm" style="padding:8px 28px;border:none;border-radius:8px;background:#5d4db6;color:#fff;font-size:14px;cursor:pointer;font-weight:500;">开始选牌</button></div></div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector("#tarot-question-input") as HTMLInputElement;
  input.focus();
  overlay.querySelector("#tarot-question-confirm")!.addEventListener("click", () => {
    const q = input.value.trim() || "未命名的问题";
    overlay.remove();
    onConfirm(q);
  });
  overlay.querySelector("#tarot-question-cancel")!.addEventListener("click", () => { overlay.remove(); onCancel(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const q = input.value.trim() || "未命名的问题"; overlay.remove(); onConfirm(q); }
    if (e.key === "Escape") { overlay.remove(); onCancel(); }
  });
}

// ---- crystal ball glow ----
function CrystalGlow({ isHovered }: { isHovered: boolean }) {
  return (
    <mesh position={CRYSTAL_POS}>
      <sphereGeometry args={[isHovered ? 0.44 : 0.38, 24, 16]} />
      <meshStandardMaterial color={isHovered ? "#c9a84c" : "#7c6fd3"} emissive={isHovered ? "#ffd977" : "#5d4db6"} emissiveIntensity={isHovered ? 0.6 : 0.2} roughness={0.3} transparent opacity={isHovered ? 0.55 : 0.25} depthWrite={false} />
    </mesh>
  );
}

// ---- revealed card face loader ----
function CardFaceTexture({ index, onLoad }: { index: number; onLoad: (tex: Texture) => void }) {
  const texture = useTexture(cardFaceUrl(index));
  useEffect(() => { onLoad(texture); }, [texture, onLoad]);
  return null;
}

// ---- single arc card ----
function ArcCard({
  index, isHovered, isSelected, flipProgress, cardFaceTexture, cardPlaneRef,
}: {
  index: number; isHovered: boolean; isSelected: boolean; flipProgress: number;
  cardFaceTexture: Texture | null;
  cardPlaneRef: (mesh: Mesh | null) => void;
}) {
  const pos = cardPosition(index);
  const yaw = cardYaw(pos);
  const groupRef = useRef<Group>(null!);
  const targetYRef = useRef(pos[1]);
  const currentYRef = useRef(pos[1]);
  const cardBackTex = useMemo(() => new CanvasTexture(createCardBackCanvas()), []);

  targetYRef.current = isSelected && flipProgress === 0 ? pos[1] + FLOAT_Y : pos[1];

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const tgt = targetYRef.current;
    const cur = currentYRef.current;
    const next = cur + (tgt - cur) * Math.min(delta * 10, 1);
    currentYRef.current = next;
    groupRef.current.position.setY(next);
  });

  const scaleX = Math.cos(flipProgress * Math.PI);
  const showFace = flipProgress > 0.5;

  return (
    <group ref={groupRef} position={[pos[0], pos[1], pos[2]]} rotation={[0, yaw, 0]}>
      {isSelected && flipProgress === 0 && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[CARD_W + 0.06, CARD_H + 0.06]} />
          <meshBasicMaterial color="#c9a84c" side={DoubleSide} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}

      {/* card plane — also used as raycast target */}
      <mesh ref={cardPlaneRef} scale-x={scaleX}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial
          map={showFace ? (cardFaceTexture ?? cardBackTex) : cardBackTex}
          side={DoubleSide}
          transparent
          opacity={isHovered && flipProgress === 0 ? 1 : 0.9}
        />
      </mesh>

      {isHovered && !isSelected && flipProgress === 0 && (
        <mesh position={[0, 0, 0.006]}>
          <planeGeometry args={[CARD_W + 0.04, CARD_H + 0.04]} />
          <meshBasicMaterial color="#ffd977" side={DoubleSide} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ---- main ----

export function TarotTable() {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const [phase, setPhase] = useState<"idle" | "question" | "select" | "reveal">("idle");
  const [hoveredCrystal, setHoveredCrystal] = useState(false);
  const [hoveredCardIdx, setHoveredCardIdx] = useState<number | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [result, setResult] = useState<TarotResult | null>(null);
  const [question, setQuestion] = useState("");
  const [flipProgress, setFlipProgress] = useState(0);
  const [cardFaceTextures, setCardFaceTextures] = useState<Map<number, Texture>>(new Map());

  const crystalMeshRef = useRef<Mesh | null>(null);
  const cardMeshMap = useRef<Map<number, Mesh>>(new Map());
  const raycasterRef = useRef(new Raycaster());
  const hoveredCrystalRef = useRef(false);
  const hoveredCardRef = useRef<number | null>(null);
  const flipStartRef = useRef(0);

  const { canvas: offCanvas, texture: screenTex } = useMemo(() => createScreenCanvas(), []);

  // screen idle
  useEffect(() => { const ctx = offCanvas.getContext("2d"); if (ctx) { drawIdle(ctx); screenTex.needsUpdate = true; } }, [offCanvas, screenTex]);

  // screen update
  useEffect(() => {
    const ctx = offCanvas.getContext("2d");
    if (!ctx) return;
    if (result) drawResult(ctx, result);
    else if (phase === "select" && selectedIndexes.length === MAX_SELECT) drawLoading(ctx);
    else drawIdle(ctx);
    screenTex.needsUpdate = true;
  }, [phase, selectedIndexes, result, offCanvas, screenTex]);

  // flip animation
  useFrame((_, delta) => {
    if (phase !== "reveal") return;
    setFlipProgress((prev) => {
      const next = prev + delta / FLIP_DURATION;
      return next >= 1 ? 1 : next;
    });
  });

  // raycasting
  useFrame(() => {
    raycasterRef.current.setFromCamera(screenCenter, camera);
    if (phase === "idle" || phase === "question") {
      const hits = crystalMeshRef.current ? raycasterRef.current.intersectObject(crystalMeshRef.current, false) : [];
      const h = hits.length > 0;
      if (hoveredCrystalRef.current !== h) { hoveredCrystalRef.current = h; setHoveredCrystal(h); }
      if (hoveredCardRef.current !== null) { hoveredCardRef.current = null; setHoveredCardIdx(null); }
      return;
    }
    if (phase === "select") {
      const cards = Array.from(cardMeshMap.current.entries());
      const hits = raycasterRef.current.intersectObjects(cards.map(([, m]) => m), false);
      if (hits.length > 0) {
        const found = cards.find(([, m]) => m === (hits[0].object as Mesh));
        const idx = found ? found[0] : null;
        if (hoveredCardRef.current !== idx) { hoveredCardRef.current = idx; setHoveredCardIdx(idx); }
      } else if (hoveredCardRef.current !== null) { hoveredCardRef.current = null; setHoveredCardIdx(null); }
      if (hoveredCrystalRef.current) { hoveredCrystalRef.current = false; setHoveredCrystal(false); }
    }
  });

  // click
  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    if (document.pointerLockElement !== domElement) return;
    if (phase === "idle" && hoveredCrystalRef.current) {
      event.preventDefault(); event.stopPropagation();
      document.exitPointerLock();
      setPhase("question");
      showQuestionOverlay(
        (q) => { setQuestion(q); setSelectedIndexes([]); setHoveredCrystal(false); setPhase("select"); setTimeout(() => domElement.requestPointerLock?.(), 150); },
        () => { setPhase("idle"); setHoveredCrystal(false); setTimeout(() => domElement.requestPointerLock?.(), 150); },
      );
      return;
    }
    if (phase === "select" && hoveredCardRef.current !== null) {
      const idx = hoveredCardRef.current;
      event.preventDefault(); event.stopPropagation();
      setSelectedIndexes((prev) => {
        if (prev.includes(idx)) return deselectCard(idx, prev);
        if (!canSelectCard(idx, prev, MAX_SELECT)) return prev;
        return selectCard(idx, prev, MAX_SELECT);
      });
    }
  }, [domElement, phase]);

  useEffect(() => { domElement.addEventListener("click", handleClick); return () => domElement.removeEventListener("click", handleClick); }, [domElement, handleClick]);

  // auto-submit when 3 selected
  useEffect(() => {
    if (phase !== "select" || selectedIndexes.length !== MAX_SELECT) return;
    const t = setTimeout(async () => {
      try {
        const res = await getTarotReading({ spread: "three_card", selectedIndexes, deck: "major" });
        if (res.success && res.data) { setResult(res.data); setPhase("reveal"); }
      } catch { /* keep selection */ }
    }, 600);
    return () => clearTimeout(t);
  }, [phase, selectedIndexes]);

  const registerCard = useCallback((index: number, mesh: Mesh | null) => {
    if (mesh) cardMeshMap.current.set(index, mesh);
    else cardMeshMap.current.delete(index);
  }, []);

  const handleFaceTextureLoad = useCallback((index: number, tex: Texture) => {
    setCardFaceTextures((prev) => {
      const next = new Map(prev);
      next.set(index, tex);
      return next;
    });
  }, []);

  return (
    <group>
      {/* crystal */}
      {phase === "idle" && <>
        <CrystalGlow isHovered={hoveredCrystal} />
        <mesh ref={crystalMeshRef} position={CRYSTAL_POS}>
          <sphereGeometry args={[CRYSTAL_RAYCAST_R, 8, 6]} />
          <meshBasicMaterial color="#fff" opacity={0} transparent />
        </mesh>
      </>}

      {/* card arc */}
      {(phase === "select" || phase === "reveal") && Array.from({ length: CARD_COUNT }, (_, i) => {
        const isHovered = hoveredCardIdx === i;
        const isSelected = selectedIndexes.includes(i);
        const isRevealedCard = phase === "reveal" && isSelected;
        return (
          <group key={i}>
            <ArcCard
              index={i} isHovered={isHovered} isSelected={isSelected}
              flipProgress={isRevealedCard ? flipProgress : 0}
              cardFaceTexture={cardFaceTextures.get(i) ?? null}
              cardPlaneRef={(m) => registerCard(i, m)}
            />
            {/* load face texture if this card was selected */}
            {isRevealedCard && !cardFaceTextures.has(i) && (
              <CardFaceTexture index={i} onLoad={(tex) => handleFaceTextureLoad(i, tex)} />
            )}
          </group>
        );
      })}

      {/* progress */}
      {phase === "select" && <SelectionProgress count={selectedIndexes.length} />}

      {/* content screen */}
      <group position={SCREEN_POS} rotation={SCREEN_ROT}>
        <mesh receiveShadow>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial map={screenTex} side={DoubleSide} transparent opacity={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <boxGeometry args={[SCREEN_W + 0.1, SCREEN_H + 0.1, 0.035]} />
          <meshBasicMaterial color="#2a2048" transparent opacity={0.32} />
        </mesh>
      </group>

      {/* question hint */}
      {phase === "idle" && hoveredCrystal && (
        <mesh position={[CRYSTAL_POS[0], CRYSTAL_POS[1] + 0.6, CRYSTAL_POS[2]]}>
          <planeGeometry args={[1.2, 0.22]} />
          <meshBasicMaterial color="#5d4db6" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
