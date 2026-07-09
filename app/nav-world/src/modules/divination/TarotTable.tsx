// ============================================================
// 塔罗桌 — 3D 交互组件
// 流程：点击水晶球 → 输入问题 → 22张牌弧形选牌(上浮) → 翻面(牌面图片)
// ============================================================

import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Texture,
  Vector2,
} from "three";
import { getTarotAiReading, getTarotReading } from "./fortuneApi";
import type { AiInterpretResult, TarotResult } from "./types";
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
const CRYSTAL_URL = "./models/fortune/tarot_crystal_ball.glb";

// ---- content screen ----
const SCREEN_POS: [number, number, number] = [0, 2.0, 5.85];
const SCREEN_ROT: [number, number, number] = [0, Math.PI, 0];
const SCREEN_W = 3.6;
const SCREEN_H = 2.25;
const CANVAS_W = 1280;
const CANVAS_H = 800;

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

const BG = "#f7f5fb";
const DARK = "#1a1436";
const ACCENT = "#5d4db6";
const GOLD = "#c9a84c";
const SOFT = "#e8e4f2";

function drawIdle(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  // bg
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  // gradient-like top bar
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  // gold line under bar
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);

  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Tarot · 塔罗占卜", w / 2, h * 0.065);

  // centered card illustration
  const cx = w / 2, cy = h * 0.52;
  // card shadow
  ctx.fillStyle = "rgba(90,77,182,0.08)";
  ctx.roundRect(cx - 64, cy - 90, 128, 180, 8); ctx.fill();
  // card bg
  ctx.fillStyle = DARK;
  ctx.roundRect(cx - 62, cy - 88, 124, 176, 6); ctx.fill();
  // gold border
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
  ctx.roundRect(cx - 56, cy - 82, 112, 164, 4); ctx.stroke();
  // inner line
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 0.8;
  ctx.roundRect(cx - 48, cy - 74, 96, 148, 3); ctx.stroke();
  // star
  ctx.fillStyle = GOLD;
  ctx.font = "42px serif"; ctx.textAlign = "center";
  ctx.fillText("\u2605", cx, cy - 12);
  // text
  ctx.fillStyle = "#fff";
  ctx.font = "15px serif";
  ctx.fillText("T A R O T", cx, cy + 28);

  // hint below
  ctx.fillStyle = "#999";
  ctx.font = `${Math.round(h * 0.028)}px sans-serif`;
  ctx.fillText("对准桌面上的水晶球开始占卜", w / 2, h * 0.88);
  // gold dot
  ctx.fillStyle = GOLD;
  ctx.beginPath(); ctx.arc(w / 2, h * 0.92, 3, 0, Math.PI * 2); ctx.fill();
}

function drawLoading(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);

  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Tarot · 塔罗占卜", w / 2, h * 0.065);

  const cx = w / 2, cy = h * 0.48;
  // three small card silhouettes
  ctx.fillStyle = SOFT;
  for (let i = 0; i < 3; i++) {
    ctx.roundRect(cx - 70 + i * 70, cy - 50, 50, 80, 4); ctx.fill();
  }
  // loading text
  ctx.fillStyle = ACCENT;
  ctx.font = `${Math.round(h * 0.032)}px sans-serif`;
  ctx.fillText("牌灵正在解读命运...", cx, cy + 60);

  ctx.fillStyle = "#bbb";
  ctx.font = `${Math.round(h * 0.026)}px sans-serif`;
  ctx.fillText("三张牌分别代表 过去 · 现在 · 未来", cx, cy + 88);
}

function drawResult(ctx: CanvasRenderingContext2D, result: TarotResult): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  // top bar
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Tarot · 占卜结果", w / 2, h * 0.065);

  const cards = result.cards;
  const colW = w / (cards.length + 0.8);
  const cardBoxW = colW * 0.82;
  const cardBoxH = h * 0.58;
  const cardStartY = h * 0.13;

  cards.forEach((card, ci) => {
    const cx = colW * (ci + 0.9);
    const bx = cx - cardBoxW / 2, by = cardStartY;

    // card background
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(90,77,182,0.1)";
    ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, cardBoxW, cardBoxH, 8); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // position label
    const posLabel = card.position === "past" ? "过去" : card.position === "present" ? "现在" : "未来";
    ctx.fillStyle = ACCENT;
    ctx.font = `500 ${Math.round(h * 0.02)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(posLabel, cx, by + h * 0.03);

    // card name
    ctx.fillStyle = DARK;
    ctx.font = `500 ${Math.round(h * 0.028)}px sans-serif`;
    ctx.fillText(card.name, cx, by + h * 0.07);

    // nameEn
    ctx.fillStyle = "#888";
    ctx.font = `${Math.round(h * 0.018)}px sans-serif`;
    ctx.fillText(card.nameEn || "", cx, by + h * 0.095);

    // orientation badge
    const oriY = by + h * 0.115;
    const isUp = card.isUpright;
    ctx.fillStyle = isUp ? "#e8f5e9" : "#fbe9e7";
    ctx.beginPath(); ctx.roundRect(cx - 28, oriY, 56, 22, 11); ctx.fill();
    ctx.fillStyle = isUp ? "#2e7d32" : "#c62828";
    ctx.font = `500 ${Math.round(h * 0.02)}px sans-serif`;
    ctx.fillText(isUp ? "正位" : "逆位", cx, oriY + 15);

    // separator
    ctx.strokeStyle = SOFT; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(bx + 14, by + h * 0.17); ctx.lineTo(bx + cardBoxW - 14, by + h * 0.17); ctx.stroke();

    // keywords
    const kwY = by + h * 0.185;
    card.keywords.slice(0, 3).forEach((kw, ki) => {
      ctx.fillStyle = ACCENT;
      ctx.font = `${Math.round(h * 0.018)}px sans-serif`;
      ctx.fillText(kw, cx, kwY + ki * h * 0.032);
    });

    // separator
    ctx.strokeStyle = SOFT; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(bx + 14, kwY + 3 * h * 0.032 + h * 0.01); ctx.lineTo(bx + cardBoxW - 14, kwY + 3 * h * 0.032 + h * 0.01); ctx.stroke();

    // meaning
    const meanY = kwY + 3 * h * 0.032 + h * 0.025;
    ctx.fillStyle = "#666";
    ctx.font = `${Math.round(h * 0.018)}px sans-serif`;
    ctx.textAlign = "center";
    const words = card.meaning;
    const maxChars = 11;
    for (let i = 0; i < words.length; i += maxChars) {
      ctx.fillText(words.slice(i, i + maxChars), cx, meanY + (i / maxChars) * h * 0.033);
    }
  });

  // bottom summary
  const summaryY = cardStartY + cardBoxH + h * 0.03;
  ctx.fillStyle = DARK;
  ctx.font = `500 ${Math.round(h * 0.025)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("综合解读", w / 2, summaryY);

  ctx.fillStyle = "#666";
  ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
  const maxChars = 42;
  for (let i = 0; i < result.summary.length; i += maxChars) {
    ctx.fillText(result.summary.slice(i, i + maxChars), w / 2, summaryY + h * 0.035 + (i / maxChars) * h * 0.035);
  }

  // gold footer line
  ctx.fillStyle = GOLD;
  ctx.fillRect(w * 0.35, h - 4, w * 0.3, 1.5);
}

function drawAiLoading(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("AI 深度解读", w / 2, h * 0.065);

  const cx = w / 2, cy = h * 0.52;
  ctx.fillStyle = ACCENT;
  ctx.font = `${Math.round(h * 0.032)}px sans-serif`;
  ctx.fillText("AI 正在分析牌阵...", cx, cy - 10);

  // animated dots
  ctx.fillStyle = SOFT;
  ctx.font = `${Math.round(h * 0.024)}px sans-serif`;
  ctx.fillText("结合问题深度推理命运走向", cx, cy + 30);

  ctx.fillStyle = GOLD;
  ctx.fillRect(w * 0.35, h * 0.82, w * 0.3, 1.5);
}

function drawAiResult(ctx: CanvasRenderingContext2D, text: string): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("AI 深度解读", w / 2, h * 0.065);

  // content card
  const pad = w * 0.06;
  const contentY = h * 0.12;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(90,77,182,0.08)";
  ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.roundRect(pad, contentY, w - pad * 2, h * 0.72, 8); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  ctx.fillStyle = "#444";
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.textAlign = "left";
  const maxChars = 48;
  const lineH = h * 0.035;
  const lines = text.split("\n").filter((l) => l.trim());

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    for (let i = 0; i < line.length; i += maxChars) {
      ctx.fillText(
        line.slice(i, i + maxChars),
        pad + w * 0.03,
        contentY + h * 0.025 + (li * 3 + (i / maxChars)) * lineH,
      );
    }
  }

  // no extra hint — page button handles navigation
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

// ---- revealed card face loader ----
function CardFaceTexture({ index, onLoad }: { index: number; onLoad: (tex: Texture) => void }) {
  const texture = useTexture(cardFaceUrl(index));
  useEffect(() => { onLoad(texture); }, [texture, onLoad]);
  return null;
}

// ---- reveal center layout ----
const REVEAL_CENTER_Y = 2.1;
const REVEAL_CENTER_Z = 4;
const REVEAL_GAP = 0.65;

function revealTargetPos(selectedIndex: number, totalSelected: number[]): [number, number, number] {
  const order = totalSelected.indexOf(selectedIndex);
  return [(order - 1) * REVEAL_GAP, REVEAL_CENTER_Y, REVEAL_CENTER_Z];
}

// ---- single arc card ----
function ArcCard({
  index, isHovered, isSelected, flipProgress, cardFaceTexture, cardPlaneRef,
  phase, selectedIndexes,
}: {
  index: number; isHovered: boolean; isSelected: boolean; flipProgress: number;
  cardFaceTexture: Texture | null;
  cardPlaneRef: (mesh: Mesh | null) => void;
  phase: string;
  selectedIndexes: number[];
}) {
  const pos = cardPosition(index);
  const yaw = cardYaw(pos);
  const groupRef = useRef<Group>(null!);
  const currentPosRef = useRef([pos[0], pos[1], pos[2]]);
  const currentYawRef = useRef(yaw);
  const cardBackTex = useMemo(() => new CanvasTexture(createCardBackCanvas()), []);

  const isReveal = phase === "reveal";
  const target = isReveal && isSelected
    ? revealTargetPos(index, selectedIndexes)
    : [pos[0], isSelected ? pos[1] + FLOAT_Y : pos[1], pos[2]];
  const targetYaw = isReveal && isSelected ? 0 : yaw;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = delta * 6;
    const c = currentPosRef.current;
    const p = groupRef.current.position;
    p.set(
      c[0] + (target[0] - c[0]) * Math.min(t, 1),
      c[1] + (target[1] - c[1]) * Math.min(t, 1),
      c[2] + (target[2] - c[2]) * Math.min(t, 1),
    );
    currentPosRef.current = [p.x, p.y, p.z];

    const cy = currentYawRef.current;
    const ny = cy + (targetYaw - cy) * Math.min(t, 1);
    groupRef.current.rotation.y = ny;
    currentYawRef.current = ny;
  });

  const scaleX = Math.cos(flipProgress * Math.PI);
  const showFace = flipProgress > 0.5;
  const showHoverUI = !isReveal;

  return (
    <group ref={groupRef} position={[pos[0], pos[1], pos[2]]} rotation={[0, yaw, 0]}>
      {isSelected && !isReveal && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[CARD_W + 0.06, CARD_H + 0.06]} />
          <meshBasicMaterial color="#c9a84c" side={DoubleSide} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}

      {/* card plane */}
      <mesh ref={cardPlaneRef} scale-x={isReveal ? scaleX : 1}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial
          map={showFace ? (cardFaceTexture ?? cardBackTex) : cardBackTex}
          side={DoubleSide}
          transparent
          opacity={isHovered && showHoverUI ? 1 : 0.9}
        />
      </mesh>

      {isHovered && !isSelected && showHoverUI && (
        <mesh position={[0, 0, 0.006]}>
          <planeGeometry args={[CARD_W + 0.04, CARD_H + 0.04]} />
          <meshBasicMaterial color="#ffd977" side={DoubleSide} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      {isHovered && isReveal && flipProgress >= 1 && (
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
  const [revealPage, setRevealPage] = useState<"cards" | "ai_loading" | "ai_result">("cards");
  const [aiText, setAiText] = useState("");
  const [hoveredPageBtn, setHoveredPageBtn] = useState(false);

  const crystalMeshRef = useRef<Mesh | null>(null);
  const crystalModelRef = useRef<Mesh[]>([]);
  const cardMeshMap = useRef<Map<number, Mesh>>(new Map());
  const raycasterRef = useRef(new Raycaster());
  const hoveredCrystalRef = useRef(false);
  const hoveredCardRef = useRef<number | null>(null);
  const flipDelayRef = useRef(0);
  // load crystal ball model for surface highlight
  const crystalGltf = useGLTF(CRYSTAL_URL);
  const crystalScene = useMemo(() => {
    const s = crystalGltf.scene.clone(true);
    crystalModelRef.current = [];
    s.traverse((c) => { if ((c as Mesh).isMesh) crystalModelRef.current.push(c as Mesh); });
    return s;
  }, [crystalGltf.scene]);

  // crystal ball surface glow on hover
  useEffect(() => {
    const emissive = hoveredCrystal ? "#ffd977" : "#7c6fd3";
    const intensity = hoveredCrystal ? 0.6 : 0.15;
    crystalModelRef.current.forEach((m) => {
      const mat = m.material as MeshStandardMaterial;
      if (mat.emissive) mat.emissive.set(emissive);
      if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = intensity;
    });
  }, [hoveredCrystal]);
  const candleMeshRef = useRef<Mesh | null>(null);
  const hoveredCandleRef = useRef(false);
  const FLIP_DELAY_MS = 900;
  const flipStartRef = useRef(0);

  const { canvas: offCanvas, texture: screenTex } = useMemo(() => createScreenCanvas(), []);

  // screen idle
  useEffect(() => { const ctx = offCanvas.getContext("2d"); if (ctx) { drawIdle(ctx); screenTex.needsUpdate = true; } }, [offCanvas, screenTex]);

  // screen update
  useEffect(() => {
    const ctx = offCanvas.getContext("2d");
    if (!ctx) return;
    if (revealPage === "ai_loading") drawAiLoading(ctx);
    else if (revealPage === "ai_result") drawAiResult(ctx, aiText);
    else if (result) drawResult(ctx, result);
    else if (phase === "select" && selectedIndexes.length === MAX_SELECT) drawLoading(ctx);
    else drawIdle(ctx);
    screenTex.needsUpdate = true;
  }, [phase, selectedIndexes, result, offCanvas, screenTex, revealPage, aiText]);

  // reset flip on enter reveal
  useEffect(() => {
    if (phase === "reveal") { setFlipProgress(0); setRevealPage("cards"); }
  }, [phase]);

  // AI fetch when revealing AI page
  useEffect(() => {
    if (revealPage !== "ai_loading" || !result || !question) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getTarotAiReading({
          question,
          spread: result.spread,
          deck: result.deck || "major",
          cards: result.cards,
        });
        if (!cancelled && res.success && res.data) {
          setAiText(res.data.interpretation);
          setRevealPage("ai_result");
        }
      } catch {
        if (!cancelled) setRevealPage("cards");
      }
    })();
    return () => { cancelled = true; };
  }, [revealPage, result, question]);

  // flip animation — delayed to let cards settle
  useFrame((_, delta) => {
    if (phase !== "reveal") {
      flipDelayRef.current = 0;
      return;
    }
    const now = performance.now();
    if (flipDelayRef.current === 0) {
      flipDelayRef.current = now + FLIP_DELAY_MS;
      return;
    }
    if (now < flipDelayRef.current) return;
    setFlipProgress((prev) => {
      const next = prev + delta / FLIP_DURATION;
      return next >= 1 ? 1 : next;
    });
  });

  // keyboard: E to flip page in reveal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" || e.repeat) return;
      if (phase !== "reveal" || flipProgress < 1) return;
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();
      setRevealPage((prev) => {
        if (prev === "cards") { setAiText(""); return "ai_loading"; }
        if (prev === "ai_result") return "cards";
        return prev;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, flipProgress]);

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
    if (phase === "reveal") {
      const crystalHits = crystalMeshRef.current ? raycasterRef.current.intersectObject(crystalMeshRef.current, false) : [];
      const cards = Array.from(cardMeshMap.current.entries());
      const cardHits = raycasterRef.current.intersectObjects(cards.map(([, m]) => m), false);
      const pageBtnHit = candleMeshRef.current ? raycasterRef.current.intersectObject(candleMeshRef.current, false).length > 0 : false;

      if (hoveredCandleRef.current !== pageBtnHit) { hoveredCandleRef.current = pageBtnHit; setHoveredPageBtn(pageBtnHit); }

      // candle has priority over cards (cards can block line of sight)
      if (pageBtnHit) {
        if (hoveredCrystalRef.current) { hoveredCrystalRef.current = false; setHoveredCrystal(false); }
        if (hoveredCardRef.current !== null) { hoveredCardRef.current = null; setHoveredCardIdx(null); }
      } else if (cardHits.length > 0) {
        const found = cards.find(([, m]) => m === (cardHits[0].object as Mesh));
        const idx = found ? found[0] : null;
        if (hoveredCardRef.current !== idx) { hoveredCardRef.current = idx; setHoveredCardIdx(idx); }
        if (hoveredCrystalRef.current) { hoveredCrystalRef.current = false; setHoveredCrystal(false); }
      } else if (pageBtnHit) {
        if (hoveredCrystalRef.current) { hoveredCrystalRef.current = false; setHoveredCrystal(false); }
        if (hoveredCardRef.current !== null) { hoveredCardRef.current = null; setHoveredCardIdx(null); }
      } else if (crystalHits.length > 0) {
        if (!hoveredCrystalRef.current) { hoveredCrystalRef.current = true; setHoveredCrystal(true); }
        if (hoveredCardRef.current !== null) { hoveredCardRef.current = null; setHoveredCardIdx(null); }
      } else {
        if (hoveredCrystalRef.current) { hoveredCrystalRef.current = false; setHoveredCrystal(false); }
        if (hoveredCardRef.current !== null) { hoveredCardRef.current = null; setHoveredCardIdx(null); }
      }
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
    if (phase === "reveal" && hoveredCandleRef.current) {
      event.preventDefault(); event.stopPropagation();
      setRevealPage((prev) => {
        if (prev === "cards") { setAiText(""); return "ai_loading"; }
        if (prev === "ai_result") return "cards";
        return prev;
      });
      return;
    }
    if (phase === "reveal" && hoveredCardRef.current !== null) {
      event.preventDefault(); event.stopPropagation();
      setSelectedIndexes([]);
      setFlipProgress(0);
      setRevealPage("cards");
      setHoveredCrystal(false);
      setHoveredCardIdx(null);
      return;
    }
    if (phase === "reveal" && hoveredCrystalRef.current) {
      event.preventDefault(); event.stopPropagation();
      setPhase("idle");
      setSelectedIndexes([]);
      setResult(null);
      setFlipProgress(0);
      setRevealPage("cards");
      setAiText("");
      setCardFaceTextures(new Map());
      setHoveredCrystal(false);
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
      {/* crystal — idle and reveal */}
      {(phase === "idle" || phase === "reveal") && <>
        <primitive object={crystalScene} position={CRYSTAL_POS} scale={0.62} />
        <mesh ref={crystalMeshRef} position={CRYSTAL_POS}>
          <sphereGeometry args={[CRYSTAL_RAYCAST_R, 8, 6]} />
          <meshBasicMaterial color="#fff" opacity={0} transparent />
        </mesh>
      </>}

      {/* card arc */}
      {(phase === "select" || phase === "reveal") && Array.from({ length: CARD_COUNT }, (_, i) => {
        // in reveal phase, only keep selected cards
        if (phase === "reveal" && !selectedIndexes.includes(i)) return null;

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
              phase={phase}
              selectedIndexes={selectedIndexes}
            />
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

      {/* candle page flip — hover glow instead of sphere */}
      <mesh ref={candleMeshRef} position={[-1.18, 1.35, 4.18]}>
        <sphereGeometry args={[0.32, 8, 6]} />
        <meshBasicMaterial color="#fff" opacity={0} transparent />
      </mesh>
      {hoveredPageBtn && (
        <pointLight position={[-1.18, 1.55, 4.18]} color="#ffd977" intensity={1.2} distance={1.5} />
      )}
    </group>
  );
}
