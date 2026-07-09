// ============================================================
// 塔罗桌 — 3D 交互组件
// 流程：点击水晶球 → 输入问题 → 22张牌弧形选牌(上浮) → 翻面(牌面图片)
// ============================================================

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  Raycaster,
  LinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from "three";
import { consumeCanvasClick } from "./canvasEvents";
import { getTarotAiReading, getTarotReading } from "./fortuneApi";
import {
  drawWrappedText,
  type FortuneQuestionControl,
} from "./screenInput";
import type { TarotResult } from "./types";
import { useScreenTextInput } from "./useScreenTextInput";
import {
  canSelectCard,
  deselectCard,
  selectCard,
} from "./business/tarotLogic";

const screenCenter = new Vector2(0, 0);

// ---- crystal ball ----
const CRYSTAL_POS: [number, number, number] = [0, 1.8, 3.72];
const CRYSTAL_RAYCAST_R = 0.42;
const CRYSTAL_URL = "./models/fortune/tarot_crystal_ball.glb";
const CRYSTAL_VISUAL_SCALE = 0.62;
const crystalSparkles = [
  { color: "#fff2b8", phase: 0.1, position: [-0.18, 0.2, 0.28], size: 0.14 },
  { color: "#ffffff", phase: 1.4, position: [0.2, 0.1, 0.31], size: 0.1 },
  { color: "#d8c9ff", phase: 2.2, position: [-0.28, -0.04, 0.18], size: 0.09 },
  { color: "#fff8d6", phase: 3.5, position: [0.06, 0.31, 0.22], size: 0.08 },
  { color: "#b8f3ff", phase: 4.6, position: [0.26, -0.16, 0.16], size: 0.07 },
] satisfies Array<{
  color: string;
  phase: number;
  position: [number, number, number];
  size: number;
}>;

// ---- content screen ----
const SCREEN_POS: [number, number, number] = [0, 3.125, 5.85];
const SCREEN_ROT: [number, number, number] = [0, Math.PI, 0];
const SCREEN_W = 7.2;
const SCREEN_H = 4.5;
const CANVAS_W = 1536;
const CANVAS_H = 960;
const questionControls: FortuneQuestionControl[] = ["input", "confirm", "cancel"];
const questionControlLayout = {
  input: { position: [0, 0.2, 0.08], size: [5.35, 0.62] },
  confirm: { position: [-1.15, -1.1, 0.08], size: [1.3, 0.46] },
  cancel: { position: [1.15, -1.1, 0.08], size: [1.3, 0.46] },
} satisfies Record<
  FortuneQuestionControl,
  { position: [number, number, number]; size: [number, number] }
>;

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
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.colorSpace = SRGBColorSpace;
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

const BG = "#ded4e6";
const DARK = "#1d102f";
const ACCENT = "#6754a8";
const ACCENT_HOVER = "#7461b8";
const GOLD = "#b99d53";
const SOFT = "#cbbfd8";
const PANEL = "#e8ddea";
const PANEL_ACTIVE = "#f0e7f2";
const TEXT = "#2c203b";
const MUTED = "#756a82";
const SUBTLE = "#9f93ad";
const HEADER_TEXT = "#f5eef9";
const GOOD_BG = "#d9e8d7";
const GOOD_TEXT = "#346f47";
const WARN_BG = "#ecd8d4";
const WARN_TEXT = "#914841";

function drawIdle(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  // bg
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  // gradient-like top bar
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  // gold line under bar
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);

  ctx.fillStyle = HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Tarot · 塔罗占卜", w / 2, h * 0.065);

  // centered card illustration
  const cx = w / 2, cy = h * 0.52;
  // card shadow
  ctx.fillStyle = "rgba(80, 58, 122, 0.08)";
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
  ctx.fillStyle = HEADER_TEXT;
  ctx.font = "15px serif";
  ctx.fillText("T A R O T", cx, cy + 28);

  // hint below
  ctx.fillStyle = MUTED;
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

  ctx.fillStyle = HEADER_TEXT;
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

  ctx.fillStyle = SUBTLE;
  ctx.font = `${Math.round(h * 0.026)}px sans-serif`;
  ctx.fillText("三张牌分别代表 过去 · 现在 · 未来", cx, cy + 88);
}

function drawQuestion(
  ctx: CanvasRenderingContext2D,
  draft: string,
  isActive: boolean,
  hoveredControl: FortuneQuestionControl | null,
): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Tarot · 输入问题", w / 2, h * 0.065);

  ctx.fillStyle = TEXT;
  ctx.font = `500 ${Math.round(h * 0.036)}px sans-serif`;
  ctx.fillText("你想问什么？", w / 2, h * 0.22);

  ctx.fillStyle = MUTED;
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.fillText("对准输入框左键开始输入", w / 2, h * 0.285);

  const inputX = w * 0.18;
  const inputY = h * 0.38;
  const inputW = w * 0.64;
  const inputH = h * 0.15;
  ctx.fillStyle = isActive || hoveredControl === "input" ? PANEL_ACTIVE : PANEL;
  ctx.beginPath(); ctx.roundRect(inputX, inputY, inputW, inputH, 14); ctx.fill();
  ctx.strokeStyle = isActive ? ACCENT : hoveredControl === "input" ? GOLD : SOFT;
  ctx.lineWidth = isActive ? 4 : 2;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = draft ? TEXT : MUTED;
  ctx.font = `${Math.round(h * 0.026)}px sans-serif`;
  const visibleDraft = draft || "例如：我的感情发展如何？";
  drawWrappedText(ctx, visibleDraft, inputX + w * 0.035, inputY + h * 0.057, 38, h * 0.04, 2);
  if (isActive) {
    ctx.fillStyle = ACCENT;
    ctx.fillRect(inputX + inputW - 28, inputY + inputH * 0.32, 3, inputH * 0.36);
  }

  const buttonY = h * 0.71;
  const buttonWidth = w * 0.18;
  const buttons = [
    { id: "confirm" as const, label: "开始选牌", x: w * 0.34 - buttonWidth / 2, width: buttonWidth },
    { id: "cancel" as const, label: "取消", x: w * 0.66 - buttonWidth / 2, width: buttonWidth },
  ];
  buttons.forEach((button) => {
    ctx.fillStyle = hoveredControl === button.id
      ? (button.id === "confirm" ? ACCENT_HOVER : PANEL_ACTIVE)
      : (button.id === "confirm" ? ACCENT : PANEL);
    ctx.beginPath();
    ctx.roundRect(button.x, buttonY, button.width, h * 0.07, 10);
    ctx.fill();
    ctx.strokeStyle = button.id === "confirm" ? ACCENT : SOFT;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = button.id === "confirm" ? HEADER_TEXT : TEXT;
    ctx.font = `500 ${Math.round(h * 0.024)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(button.label, button.x + button.width / 2, buttonY + h * 0.046);
  });

  ctx.fillStyle = MUTED;
  ctx.font = `${Math.round(h * 0.019)}px sans-serif`;
  ctx.fillText("Enter 确认 · Esc 取消", w / 2, h * 0.88);
}

function drawResult(ctx: CanvasRenderingContext2D, result: TarotResult): void {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  // top bar
  ctx.fillStyle = DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = HEADER_TEXT;
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
    ctx.fillStyle = PANEL_ACTIVE;
    ctx.shadowColor = "rgba(80, 58, 122, 0.12)";
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
    ctx.fillStyle = TEXT;
    ctx.font = `500 ${Math.round(h * 0.028)}px sans-serif`;
    ctx.fillText(card.name, cx, by + h * 0.07);

    // nameEn
    ctx.fillStyle = MUTED;
    ctx.font = `${Math.round(h * 0.018)}px sans-serif`;
    ctx.fillText(card.nameEn || "", cx, by + h * 0.095);

    // orientation badge
    const oriY = by + h * 0.115;
    const isUp = card.isUpright;
    ctx.fillStyle = isUp ? GOOD_BG : WARN_BG;
    ctx.beginPath(); ctx.roundRect(cx - 28, oriY, 56, 22, 11); ctx.fill();
    ctx.fillStyle = isUp ? GOOD_TEXT : WARN_TEXT;
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
    ctx.fillStyle = MUTED;
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
  ctx.fillStyle = TEXT;
  ctx.font = `500 ${Math.round(h * 0.025)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("综合解读", w / 2, summaryY);

  ctx.fillStyle = MUTED;
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
  ctx.fillStyle = HEADER_TEXT;
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
  ctx.fillStyle = HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("AI 深度解读", w / 2, h * 0.065);

  // content card
  const pad = w * 0.06;
  const contentY = h * 0.12;
  ctx.fillStyle = PANEL_ACTIVE;
  ctx.shadowColor = "rgba(80, 58, 122, 0.1)";
  ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.roundRect(pad, contentY, w - pad * 2, h * 0.72, 8); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  ctx.fillStyle = TEXT;
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

function SparklingCrystalEffect({ isHovered }: { isHovered: boolean }) {
  const glowRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const ringGroupRef = useRef<Group>(null);
  const lightRef = useRef<PointLight>(null);
  const sparkleRefs = useRef<Array<Group | null>>([]);

  useFrame((_, delta) => {
    const t = performance.now() / 1000;
    const hoverBoost = isHovered ? 1.18 : 1;

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.2) * 0.025 * hoverBoost;
      coreRef.current.scale.setScalar(pulse);
    }

    if (glowRef.current) {
      const pulse = 1 + Math.sin(t * 1.55) * 0.08 * hoverBoost;
      glowRef.current.scale.setScalar(pulse);
      const material = glowRef.current.material as MeshBasicMaterial;
      material.opacity = (isHovered ? 0.34 : 0.24) + Math.sin(t * 1.8) * 0.045;
    }

    if (ringGroupRef.current) {
      ringGroupRef.current.rotation.y += delta * 0.32;
      ringGroupRef.current.rotation.z = Math.sin(t * 0.55) * 0.08;
    }

    if (lightRef.current) {
      lightRef.current.intensity = (isHovered ? 1.65 : 1.05) + Math.sin(t * 2.6) * 0.22;
    }

    sparkleRefs.current.forEach((sparkle, index) => {
      if (!sparkle) return;
      const seed = crystalSparkles[index];
      const pulse = 0.68 + Math.sin(t * 3.4 + seed.phase) * 0.32;
      sparkle.scale.setScalar((0.75 + pulse * 0.75) * (isHovered ? 1.18 : 1));
      sparkle.rotation.z += delta * (0.65 + index * 0.08);
    });
  });

  return (
    <group position={CRYSTAL_POS}>
      <pointLight
        ref={lightRef}
        color="#c6b6ff"
        distance={2.6}
        intensity={1.05}
      />
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.47, 48, 32]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color="#8d78ff"
          depthWrite={false}
          opacity={0.24}
          transparent
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.405, 48, 32]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.04}
          color="#d9d2ff"
          depthWrite={false}
          emissive="#7061ff"
          emissiveIntensity={isHovered ? 0.55 : 0.34}
          metalness={0}
          opacity={0.42}
          roughness={0.08}
          thickness={0.82}
          transmission={0.38}
          transparent
        />
      </mesh>
      <group ref={ringGroupRef}>
        <mesh rotation={[Math.PI / 2.6, 0, 0.18]}>
          <torusGeometry args={[0.47, 0.006, 8, 96]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color="#fff0a8"
            depthWrite={false}
            opacity={0.48}
            transparent
          />
        </mesh>
        <mesh rotation={[Math.PI / 2.2, 0.55, -0.4]}>
          <torusGeometry args={[0.35, 0.004, 8, 80]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color="#bdf3ff"
            depthWrite={false}
            opacity={0.32}
            transparent
          />
        </mesh>
      </group>
      {crystalSparkles.map((sparkle, index) => (
        <group
          key={`${sparkle.position.join(":")}-${sparkle.phase}`}
          ref={(node) => {
            sparkleRefs.current[index] = node;
          }}
          position={sparkle.position}
        >
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[sparkle.size, sparkle.size * 0.18]} />
            <meshBasicMaterial
              blending={AdditiveBlending}
              color={sparkle.color}
              depthWrite={false}
              opacity={0.82}
              side={DoubleSide}
              transparent
            />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <planeGeometry args={[sparkle.size * 0.18, sparkle.size]} />
            <meshBasicMaterial
              blending={AdditiveBlending}
              color={sparkle.color}
              depthWrite={false}
              opacity={0.82}
              side={DoubleSide}
              transparent
            />
          </mesh>
        </group>
      ))}
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
  const [questionDraft, setQuestionDraft] = useState("");
  const [isQuestionInputActive, setIsQuestionInputActive] = useState(false);
  const [hoveredQuestionControl, setHoveredQuestionControl] =
    useState<FortuneQuestionControl | null>(null);

  const crystalMeshRef = useRef<Mesh | null>(null);
  const crystalModelRef = useRef<Mesh[]>([]);
  const cardMeshMap = useRef<Map<number, Mesh>>(new Map());
  const questionControlMeshesRef = useRef<
    Partial<Record<FortuneQuestionControl, Mesh>>
  >({});
  const raycasterRef = useRef(new Raycaster());
  const hoveredCrystalRef = useRef(false);
  const hoveredCardRef = useRef<number | null>(null);
  const hoveredQuestionControlRef = useRef<FortuneQuestionControl | null>(null);
  const cardFaceTextureLoader = useMemo(() => new TextureLoader(), []);
  const cardFaceTexturesRef = useRef(cardFaceTextures);
  const loadingCardFaceIndexesRef = useRef<Set<number>>(new Set());
  const flipDelayRef = useRef(0);
  // load crystal ball model for surface highlight
  const crystalGltf = useGLTF(CRYSTAL_URL);
  const crystalScene = useMemo(() => {
    const s = crystalGltf.scene.clone(true);
    crystalModelRef.current = [];
    s.traverse((c) => {
      if (!(c as Mesh).isMesh) return;
      const mesh = c as Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.material = new MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        color: "#cfc7ff",
        depthWrite: false,
        emissive: "#5f4ee8",
        emissiveIntensity: 0.28,
        metalness: 0,
        opacity: 0.34,
        roughness: 0.06,
        thickness: 0.9,
        transmission: 0.45,
        transparent: true,
      });
      crystalModelRef.current.push(mesh);
    });
    return s;
  }, [crystalGltf.scene]);

  // crystal ball surface glow on hover
  useEffect(() => {
    const emissive = hoveredCrystal ? "#fff0a8" : "#5f4ee8";
    const intensity = hoveredCrystal ? 0.68 : 0.28;
    const opacity = hoveredCrystal ? 0.44 : 0.34;
    crystalModelRef.current.forEach((m) => {
      const mat = m.material as MeshStandardMaterial;
      if (mat.emissive) mat.emissive.set(emissive);
      if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = intensity;
      if (mat.transparent) mat.opacity = opacity;
    });
  }, [hoveredCrystal]);
  const candleMeshRef = useRef<Mesh | null>(null);
  const hoveredCandleRef = useRef(false);
  const FLIP_DELAY_MS = 900;
  const flipStartRef = useRef(0);

  const { canvas: offCanvas, texture: screenTex } = useMemo(() => createScreenCanvas(), []);

  useEffect(() => {
    cardFaceTexturesRef.current = cardFaceTextures;
  }, [cardFaceTextures]);

  const loadCardFaceTexture = useCallback((index: number) => {
    if (
      cardFaceTexturesRef.current.has(index) ||
      loadingCardFaceIndexesRef.current.has(index)
    ) {
      return;
    }

    loadingCardFaceIndexesRef.current.add(index);
    cardFaceTextureLoader.load(
      cardFaceUrl(index),
      (texture) => {
        loadingCardFaceIndexesRef.current.delete(index);
        setCardFaceTextures((prev) => {
          if (prev.has(index)) return prev;
          const next = new Map(prev);
          next.set(index, texture);
          return next;
        });
      },
      undefined,
      () => {
        loadingCardFaceIndexesRef.current.delete(index);
      },
    );
  }, [cardFaceTextureLoader]);

  const registerQuestionControl = useCallback(
    (id: FortuneQuestionControl) => (mesh: Mesh | null) => {
      if (mesh) questionControlMeshesRef.current[id] = mesh;
      else delete questionControlMeshesRef.current[id];
    },
    [],
  );

  const setAimedQuestionControl = useCallback(
    (id: FortuneQuestionControl | null) => {
      if (hoveredQuestionControlRef.current === id) return;
      hoveredQuestionControlRef.current = id;
      setHoveredQuestionControl(id);
    },
    [],
  );

  const closeQuestionInput = useCallback(() => {
    setIsQuestionInputActive(false);
  }, []);

  const cancelQuestion = useCallback(() => {
    setQuestionDraft("");
    setIsQuestionInputActive(false);
    setAimedQuestionControl(null);
    setHoveredCrystal(false);
    setPhase("idle");
  }, [setAimedQuestionControl]);

  const confirmQuestion = useCallback(() => {
    const q = questionDraft.trim() || "未命名的问题";
    setQuestion(q);
    setQuestionDraft("");
    setIsQuestionInputActive(false);
    setAimedQuestionControl(null);
    setSelectedIndexes([]);
    setResult(null);
    setFlipProgress(0);
    setRevealPage("cards");
    setAiText("");
    setCardFaceTextures(new Map());
    setHoveredCrystal(false);
    setPhase("select");
  }, [questionDraft, setAimedQuestionControl]);

  useScreenTextInput({
    active: phase === "question" && isQuestionInputActive,
    ariaLabel: "塔罗占卜问题输入",
    onCancel: cancelQuestion,
    onChange: setQuestionDraft,
    onConfirm: confirmQuestion,
    value: questionDraft,
  });

  // screen idle
  useEffect(() => { const ctx = offCanvas.getContext("2d"); if (ctx) { drawIdle(ctx); screenTex.needsUpdate = true; } }, [offCanvas, screenTex]);

  // screen update
  useEffect(() => {
    const ctx = offCanvas.getContext("2d");
    if (!ctx) return;
    if (revealPage === "ai_loading") drawAiLoading(ctx);
    else if (revealPage === "ai_result") drawAiResult(ctx, aiText);
    else if (phase === "question") drawQuestion(ctx, questionDraft, isQuestionInputActive, hoveredQuestionControl);
    else if (result) drawResult(ctx, result);
    else if (phase === "select" && selectedIndexes.length === MAX_SELECT) drawLoading(ctx);
    else drawIdle(ctx);
    screenTex.needsUpdate = true;
  }, [
    phase,
    selectedIndexes,
    result,
    offCanvas,
    screenTex,
    revealPage,
    aiText,
    questionDraft,
    isQuestionInputActive,
    hoveredQuestionControl,
  ]);

  // reset flip on enter reveal
  useEffect(() => {
    if (phase === "reveal") { setFlipProgress(0); setRevealPage("cards"); }
  }, [phase]);

  useEffect(() => {
    if (phase !== "select" && phase !== "reveal") return;
    selectedIndexes.forEach(loadCardFaceTexture);
  }, [loadCardFaceTexture, phase, selectedIndexes]);

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
    if (phase === "question") {
      const controls = questionControls
        .map((id) => [id, questionControlMeshesRef.current[id]] as const)
        .filter((entry): entry is readonly [FortuneQuestionControl, Mesh] =>
          Boolean(entry[1]),
        );
      const hits = raycasterRef.current.intersectObjects(
        controls.map(([, mesh]) => mesh),
        false,
      );
      const aimedEntry = hits
        .map((hit) =>
          controls.find(([, mesh]) => mesh === hit.object) ?? null,
        )
        .find((entry): entry is readonly [FortuneQuestionControl, Mesh] =>
          Boolean(entry),
        );
      setAimedQuestionControl(aimedEntry?.[0] ?? null);
      if (hoveredCrystalRef.current) { hoveredCrystalRef.current = false; setHoveredCrystal(false); }
      if (hoveredCardRef.current !== null) { hoveredCardRef.current = null; setHoveredCardIdx(null); }
      return;
    }
    if (phase === "idle") {
      setAimedQuestionControl(null);
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
    if (phase !== "question" && document.pointerLockElement !== domElement) return;
    if (phase === "idle" && hoveredCrystalRef.current) {
      consumeCanvasClick(event);
      setQuestionDraft("");
      setIsQuestionInputActive(true);
      setAimedQuestionControl(null);
      setSelectedIndexes([]);
      setResult(null);
      setFlipProgress(0);
      setRevealPage("cards");
      setAiText("");
      setCardFaceTextures(new Map());
      setPhase("question");
      return;
    }
    if (phase === "question") {
      const control = hoveredQuestionControlRef.current;
      consumeCanvasClick(event);
      if (control === "confirm") {
        confirmQuestion();
      } else if (control === "cancel") {
        cancelQuestion();
      } else if (control === "input") {
        setIsQuestionInputActive(true);
      } else if (isQuestionInputActive) {
        closeQuestionInput();
      }
      return;
    }
    if (phase === "reveal" && hoveredCandleRef.current) {
      consumeCanvasClick(event);
      setRevealPage((prev) => {
        if (prev === "cards") { setAiText(""); return "ai_loading"; }
        if (prev === "ai_result") return "cards";
        return prev;
      });
      return;
    }
    if (phase === "reveal" && hoveredCardRef.current !== null) {
      consumeCanvasClick(event);
      setSelectedIndexes([]);
      setFlipProgress(0);
      setRevealPage("cards");
      setHoveredCrystal(false);
      setHoveredCardIdx(null);
      return;
    }
    if (phase === "reveal" && hoveredCrystalRef.current) {
      consumeCanvasClick(event);
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
      consumeCanvasClick(event);
      setSelectedIndexes((prev) => {
        if (prev.includes(idx)) return deselectCard(idx, prev);
        if (!canSelectCard(idx, prev, MAX_SELECT)) return prev;
        return selectCard(idx, prev, MAX_SELECT);
      });
    }
  }, [
    cancelQuestion,
    closeQuestionInput,
    confirmQuestion,
    domElement,
    isQuestionInputActive,
    phase,
    setAimedQuestionControl,
  ]);

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

  return (
    <group>
      {/* crystal model stays on the table; only its click target is phase-limited. */}
      <primitive object={crystalScene} position={CRYSTAL_POS} scale={CRYSTAL_VISUAL_SCALE} />
      <SparklingCrystalEffect isHovered={hoveredCrystal} />
      {(phase === "idle" || phase === "reveal") && (
        <mesh ref={crystalMeshRef} position={CRYSTAL_POS}>
          <sphereGeometry args={[CRYSTAL_RAYCAST_R, 8, 6]} />
          <meshBasicMaterial visible={false} depthWrite={false} depthTest={false} />
        </mesh>
      )}

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
          </group>
        );
      })}

      {/* progress */}
      {phase === "select" && <SelectionProgress count={selectedIndexes.length} />}

      {/* content screen */}
      <group position={SCREEN_POS} rotation={SCREEN_ROT}>
        <mesh receiveShadow>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial map={screenTex} side={DoubleSide} toneMapped={false} />
        </mesh>
        {phase === "question" && questionControls.map((id) => {
          const layout = questionControlLayout[id];
          return (
            <mesh
              key={id}
              ref={registerQuestionControl(id)}
              position={layout.position}
            >
              <planeGeometry args={layout.size} />
              <meshBasicMaterial
                depthTest={false}
                depthWrite={false}
                side={DoubleSide}
                visible={false}
              />
            </mesh>
          );
        })}
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
        <meshBasicMaterial visible={false} depthWrite={false} depthTest={false} />
      </mesh>
      {hoveredPageBtn && (
        <pointLight position={[-1.18, 1.55, 4.18]} color="#ffd977" intensity={1.2} distance={1.5} />
      )}
    </group>
  );
}
