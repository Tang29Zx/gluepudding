// ============================================================
// 周易占卜 — 3D 铜钱动画
// 6轮投掷，每轮3枚铜钱飞出旋转落地，累积六爻展示结果
// ============================================================

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  SRGBColorSpace,
  Vector2,
} from "three";
import {
  getYaoLabel,
  isChangingLine,
  isYang,
  lookUpChangedHexagram,
  lookUpHexagram,
} from "./business/ichingLogic";
import { consumeCanvasClick } from "./canvasEvents";
import { getIchingAiReading } from "./fortuneApi";
import type { LotResult } from "./ichingLots";
import {
  drawFittedScreenText,
  drawWrappedText,
  type FortuneQuestionControl,
} from "./screenInput";
import { staticAssetUrl } from "../../assets/staticAssetUrl";
import type { IchingResult, YaoValue } from "./types";
import { useScreenTextInput } from "./useScreenTextInput";

const screenCenter = new Vector2(0, 0);

// iching-coin model in tent local: positionOnIchingTable(0.48, 1.112, 0.22) → ~[5.78, 1.112, 0.48]
const COIN_URL = staticAssetUrl("./models/fortune/iching_coin.glb");
const ICHING_TABLE_COIN_Y = 1.112;
const TRIGGER_POS: [number, number, number] = [5.78, ICHING_TABLE_COIN_Y, 0.48];
const COIN_BASE_Y = ICHING_TABLE_COIN_Y;

const YAO_X = 5.78;
const YAO_Z = 0.48;

const ROUNDS = 6;
const COIN_TOSS_DURATION = 0.72;
const COIN_GAP_MS = 70;
const ROUND_GAP_MS = 130;
const RESULT_DELAY_MS = 300;
const COIN_SPREAD = 0.22;
const COIN_SCALE = 0.58;

// coin result: 3=正面(yang), 2=反面(yin)
function coinResult(): 2 | 3 { return Math.random() < 0.5 ? 2 : 3; }

interface CoinState {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  result: 2 | 3;
  startX: number; startZ: number;
  endX: number; endZ: number;
  flightDuration: number;
  bounceDuration: number;
  peakHeight: number;
  lateralDrift: number;
  forwardDrift: number;
  slideX: number;
  slideZ: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  finalRx: number;
  finalRy: number;
  finalRz: number;
  impact: number;
  impactStrength: number;
  done: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(t: number): number {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function makeCoinState(roundIndex: number, coinIndex: number): CoinState {
  const result = coinResult();
  const startX = YAO_X + (coinIndex - 1) * 0.1;
  const startZ = YAO_Z - 0.28;
  const endX = YAO_X + (coinIndex - 1) * COIN_SPREAD + (Math.random() - 0.5) * 0.08;
  const endZ = YAO_Z + (Math.random() - 0.5) * 0.18 + (roundIndex % 2 === 0 ? 0.02 : -0.02);
  const spinDirection = Math.random() < 0.5 ? -1 : 1;

  return {
    bounceDuration: 0.18 + Math.random() * 0.02,
    done: false,
    endX,
    endZ,
    finalRx: result === 3 ? 0 : Math.PI,
    finalRy: Math.random() * Math.PI * 2,
    finalRz: 0,
    flightDuration: 0.48 + Math.random() * 0.03,
    forwardDrift: (Math.random() - 0.5) * 0.045,
    impact: 0,
    impactStrength: 0.58 + Math.random() * 0.2,
    lateralDrift: (Math.random() - 0.5) * 0.08,
    peakHeight: 0.4 + Math.random() * 0.12,
    result,
    rx: 0,
    ry: 0,
    rz: 0,
    slideX: (Math.random() - 0.5) * 0.025,
    slideZ: (Math.random() - 0.5) * 0.025,
    spinX: spinDirection * (3.8 + Math.random() * 0.8) * Math.PI * 2,
    spinY: (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.4) * Math.PI * 2,
    spinZ: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 0.5) * Math.PI * 2,
    startX,
    startZ,
    x: startX,
    y: COIN_BASE_Y,
    z: startZ,
  };
}

function makeCastingPlan(): CoinState[][] {
  return Array.from({ length: ROUNDS }, (_, roundIndex) =>
    [0, 1, 2].map((coinIndex) => makeCoinState(roundIndex, coinIndex)),
  );
}

function yaoFromCoins(states: CoinState[]): YaoValue {
  const total = states.reduce<number>(
    (currentTotal, coin) => currentTotal + coin.result,
    0,
  );

  return total as YaoValue;
}

function updateCoinState(state: CoinState, roundTime: number): void {
  const localTime = roundTime;

  if (localTime <= 0) {
    state.x = state.startX;
    state.y = COIN_BASE_Y;
    state.z = state.startZ;
    state.rx = 0;
    state.ry = 0;
    state.rz = state.finalRz;
    state.impact = 0;
    state.done = false;
    return;
  }

  const flightT = clamp01(localTime / state.flightDuration);
  if (flightT < 1) {
    const travel = smoothstep(flightT);
    const orient = smoothstep((flightT - 0.14) / 0.86);
    state.x = lerp(state.startX, state.endX, travel) + Math.sin(flightT * Math.PI) * state.lateralDrift;
    state.z = lerp(state.startZ, state.endZ, travel) + Math.sin(flightT * Math.PI * 0.85) * state.forwardDrift;
    state.y = COIN_BASE_Y + Math.sin(flightT * Math.PI) * state.peakHeight;
    state.rx = state.finalRx + (1 - orient) * state.spinX;
    state.ry = state.finalRy + (1 - orient) * state.spinY;
    state.rz = state.finalRz + (1 - orient) * state.spinZ;
    state.impact = 0;
    state.done = false;
    return;
  }

  const bounceT = clamp01((localTime - state.flightDuration) / state.bounceDuration);
  const settle = 1 - bounceT;
  const bounce = Math.abs(Math.sin(bounceT * Math.PI * 1.85)) * settle * 0.035;
  const wobble = Math.sin(bounceT * Math.PI * 4.4) * settle;
  state.x = state.endX + state.slideX * settle * Math.sin(bounceT * Math.PI * 1.6);
  state.z = state.endZ + state.slideZ * settle * Math.cos(bounceT * Math.PI * 1.6);
  state.y = COIN_BASE_Y + bounce;
  state.rx = state.finalRx + wobble * 0.08;
  state.ry = state.finalRy;
  state.rz = state.finalRz;
  state.impact = Math.max(0, 1 - bounceT * 1.45) * state.impactStrength;
  state.done = bounceT >= 1;

  if (state.done) {
    state.x = state.endX;
    state.y = COIN_BASE_Y;
    state.z = state.endZ;
    state.rx = state.finalRx;
    state.ry = state.finalRy;
    state.rz = state.finalRz;
    state.impact = 0;
  }
}

function applyCoinVisual(object: Object3D | null, state: CoinState): void {
  if (!object) return;
  object.visible = true;
  object.position.set(state.x, state.y, state.z);
  object.rotation.set(state.rx, state.ry, state.rz);
  object.scale.setScalar(COIN_SCALE);
}

function settleCoinState(state: CoinState): void {
  state.x = state.endX;
  state.y = COIN_BASE_Y;
  state.z = state.endZ;
  state.rx = state.finalRx;
  state.ry = state.finalRy;
  state.rz = state.finalRz;
  state.impact = 0;
  state.done = true;
}

function hideObject(object: Object3D | null): void {
  if (object) object.visible = false;
}

function applyImpactVisual(ring: Mesh | null, state: CoinState): void {
  const visible = state.impact > 0.025;
  if (ring) {
    ring.visible = visible;
    ring.position.set(state.x, COIN_BASE_Y + 0.012, state.z);
    const progress = 1 - clamp01(state.impact / Math.max(state.impactStrength, 0.001));
    ring.scale.setScalar(0.82 + progress * 1.55);
    const material = ring.material;
    if (material instanceof MeshBasicMaterial) {
      material.opacity = visible ? Math.min(0.32, state.impact * 0.24) : 0;
    }
  }
}

// ---- content screen ----
const SCREEN_POS: [number, number, number] = [7.45, 3.125, 0];
const SCREEN_ROT: [number, number, number] = [0, -Math.PI / 2, 0];
const SCREEN_W = 7.2; const SCREEN_H = 4.5;
const CANVAS_W = 1536; const CANVAS_H = 960;
const questionControls: FortuneQuestionControl[] = ["input", "confirm", "cancel"];
const questionControlLayout = {
  input: { position: [0, 0.2, 0.08], size: [5.35, 0.62] },
  confirm: { position: [-1.15, -1.1, 0.08], size: [1.3, 0.46] },
  cancel: { position: [1.15, -1.1, 0.08], size: [1.3, 0.46] },
} satisfies Record<
  FortuneQuestionControl,
  { position: [number, number, number]; size: [number, number] }
>;

const SCREEN_BG = "#ded4e6";
const SCREEN_DARK = "#1d102f";
const SCREEN_ACCENT = "#6754a8";
const SCREEN_ACCENT_HOVER = "#7461b8";
const SCREEN_GOLD = "#b99d53";
const SCREEN_SOFT = "#cbbfd8";
const SCREEN_PANEL = "#e8ddea";
const SCREEN_PANEL_ACTIVE = "#f0e7f2";
const SCREEN_TEXT = "#2c203b";
const SCREEN_MUTED = "#756a82";
const SCREEN_HEADER_TEXT = "#f5eef9";
const SCREEN_CHANGE = "#914841";

function createScreenCanvas() {
  const c = document.createElement("canvas"); c.width = CANVAS_W; c.height = CANVAS_H;
  const t = new CanvasTexture(c); t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.colorSpace = SRGBColorSpace;
  return { canvas: c, texture: t };
}

function drawIdle(ctx: CanvasRenderingContext2D) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("I Ching · 周易占卜", w / 2, h * 0.065);
  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.028)}px sans-serif`;
  ctx.fillText("对准桌面上的铜钱开始起卦", w / 2, h * 0.48);
  ctx.fillStyle = SCREEN_GOLD;
  ctx.beginPath(); ctx.arc(w / 2, h * 0.54, 3, 0, Math.PI * 2); ctx.fill();
}

function drawCasting(ctx: CanvasRenderingContext2D, round: number, lines: YaoValue[]) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText(`第 ${round + 1} / 6 爻`, w / 2, h * 0.065);
  // show accumulated lines
  const lineY = h * 0.5;
  for (let i = 0; i < lines.length; i++) {
    const y = lineY - (lines.length - 1 - i) * h * 0.07;
    const v = lines[i];
    const isYin = v === 6 || v === 8;
    const chg = v === 6 || v === 9;
    ctx.fillStyle = chg ? SCREEN_CHANGE : SCREEN_TEXT;
    ctx.font = `${Math.round(h * 0.026)}px sans-serif`;
    ctx.fillText(isYin ? "━  ╋  ━" : "━━━━━", w / 2, y);
    ctx.fillStyle = chg ? SCREEN_CHANGE : SCREEN_MUTED;
    ctx.font = `${Math.round(h * 0.018)}px sans-serif`;
    ctx.fillText(getYaoLabel(v), w / 2 + w * 0.12, y);
  }
  // current round indicator
  ctx.fillStyle = SCREEN_GOLD;
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.fillText("铜钱投掷中...", w / 2, lineY + h * 0.08);
}

function drawQuestion(
  ctx: CanvasRenderingContext2D,
  draft: string,
  isActive: boolean,
  hoveredControl: FortuneQuestionControl | null,
) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("I Ching · 输入问题", w / 2, h * 0.065);

  ctx.fillStyle = SCREEN_TEXT;
  ctx.font = `500 ${Math.round(h * 0.036)}px sans-serif`;
  ctx.fillText("你想卜问什么？", w / 2, h * 0.22);

  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.fillText("对准输入框左键开始输入", w / 2, h * 0.285);

  const inputX = w * 0.18;
  const inputY = h * 0.38;
  const inputW = w * 0.64;
  const inputH = h * 0.15;
  ctx.fillStyle = isActive || hoveredControl === "input" ? SCREEN_PANEL_ACTIVE : SCREEN_PANEL;
  ctx.beginPath(); ctx.roundRect(inputX, inputY, inputW, inputH, 14); ctx.fill();
  ctx.strokeStyle = isActive ? SCREEN_ACCENT : hoveredControl === "input" ? SCREEN_GOLD : SCREEN_SOFT;
  ctx.lineWidth = isActive ? 4 : 2;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = draft ? SCREEN_TEXT : SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.026)}px sans-serif`;
  drawWrappedText(
    ctx,
    draft || "例如：此行是否顺利？",
    inputX + w * 0.035,
    inputY + h * 0.057,
    34,
    h * 0.04,
    2,
  );
  if (isActive) {
    ctx.fillStyle = SCREEN_ACCENT;
    ctx.fillRect(inputX + inputW - 24, inputY + inputH * 0.32, 3, inputH * 0.36);
  }

  const buttonY = h * 0.71;
  const buttonWidth = w * 0.18;
  const buttons = [
    { id: "confirm" as const, label: "开始起卦", x: w * 0.34 - buttonWidth / 2, width: buttonWidth },
    { id: "cancel" as const, label: "取消", x: w * 0.66 - buttonWidth / 2, width: buttonWidth },
  ];
  buttons.forEach((button) => {
    ctx.fillStyle = hoveredControl === button.id
      ? (button.id === "confirm" ? SCREEN_ACCENT_HOVER : SCREEN_PANEL_ACTIVE)
      : (button.id === "confirm" ? SCREEN_ACCENT : SCREEN_PANEL);
    ctx.beginPath(); ctx.roundRect(button.x, buttonY, button.width, h * 0.07, 10); ctx.fill();
    ctx.strokeStyle = button.id === "confirm" ? SCREEN_ACCENT : SCREEN_SOFT;
    ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = button.id === "confirm" ? SCREEN_HEADER_TEXT : SCREEN_TEXT;
    ctx.font = `500 ${Math.round(h * 0.024)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(button.label, button.x + button.width / 2, buttonY + h * 0.046);
  });

  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.019)}px sans-serif`;
  ctx.fillText("Enter 确认 · Esc 取消", w / 2, h * 0.88);
}

function drawResult(ctx: CanvasRenderingContext2D, result: IchingResult) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("I Ching · 占卜结果", w / 2, h * 0.065);

  // hexagram display
  const orig = result.originalHexagram;
  const chg = result.changedHexagram;
  const hasChange = chg && result.changingLines.length > 0;

  ctx.fillStyle = SCREEN_TEXT;
  ctx.font = `500 ${Math.round(h * 0.045)}px sans-serif`;
  ctx.fillText(orig.symbol, w * 0.28, h * 0.22);
  ctx.font = `500 ${Math.round(h * 0.03)}px sans-serif`;
  ctx.fillText(orig.name, w * 0.28, h * 0.28);
  ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
  ctx.fillStyle = SCREEN_MUTED;
  ctx.fillText(`第${orig.number}卦`, w * 0.28, h * 0.33);

  if (hasChange) {
    ctx.fillStyle = SCREEN_GOLD; ctx.font = `${Math.round(h * 0.025)}px sans-serif`;
    ctx.fillText("→", w * 0.5, h * 0.24);
    ctx.fillStyle = SCREEN_ACCENT;
    ctx.font = `500 ${Math.round(h * 0.045)}px sans-serif`;
    ctx.fillText(chg!.symbol, w * 0.72, h * 0.22);
    ctx.font = `500 ${Math.round(h * 0.03)}px sans-serif`;
    ctx.fillText(chg!.name, w * 0.72, h * 0.28);
    ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
    ctx.fillStyle = SCREEN_MUTED;
    ctx.fillText(`第${chg!.number}卦`, w * 0.72, h * 0.33);
    ctx.fillStyle = SCREEN_CHANGE;
    ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
    ctx.fillText(`变爻：第${result.changingLines.join("、")}爻`, w / 2, h * 0.38);
  }

  // description
  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.024)}px sans-serif`;
  ctx.textAlign = "center";
  const desc = orig.description;
  const maxChars = 36;
  for (let i = 0; i < desc.length; i += maxChars) {
    ctx.fillText(desc.slice(i, i + maxChars), w / 2, h * 0.46 + (i / maxChars) * h * 0.04);
  }

  // summary
  ctx.fillStyle = SCREEN_TEXT;
  ctx.font = `500 ${Math.round(h * 0.025)}px sans-serif`;
  ctx.fillText("综合解读", w / 2, h * 0.58);
  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
  for (let i = 0; i < result.summary.length; i += 40) {
    ctx.fillText(result.summary.slice(i, i + 40), w / 2, h * 0.62 + (i / 40) * h * 0.035);
  }

  // lines display
  const lineY = h * 0.78;
  const displayLines = result.lines.slice().reverse();
  ctx.fillStyle = SCREEN_ACCENT;
  ctx.font = `500 ${Math.round(h * 0.022)}px sans-serif`;
  ctx.fillText("六爻（从上往下）", w / 2, lineY);
  for (let li = 0; li < displayLines.length; li++) {
    const l = displayLines[li];
    const isYin = !isYang(l.value);
    const chgLine = l.isChanging;
    ctx.fillStyle = chgLine ? SCREEN_CHANGE : SCREEN_TEXT;
    ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
    ctx.fillText(
      `${l.position}爻 ${isYin ? "━╋━" : "━━━"} ${l.label}`,
      w / 2,
      lineY + h * 0.04 + li * h * 0.032,
    );
  }

  // hint removed — use table click instead
}

function drawLotResult(ctx: CanvasRenderingContext2D, lot: LotResult) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("I Ching · 抽签结果", w / 2, h * 0.065);

  ctx.fillStyle = SCREEN_ACCENT;
  ctx.font = `500 ${Math.round(h * 0.032)}px sans-serif`;
  ctx.fillText(`第${lot.id}签 · ${lot.level}`, w / 2, h * 0.2);
  ctx.fillStyle = SCREEN_GOLD;
  ctx.font = `500 ${Math.round(h * 0.024)}px sans-serif`;
  ctx.fillText(lot.tag, w / 2, h * 0.255);

  const cardX = w * 0.13;
  const cardY = h * 0.33;
  const cardW = w * 0.74;
  const cardH = h * 0.24;
  ctx.fillStyle = SCREEN_PANEL_ACTIVE;
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 12); ctx.fill();
  ctx.strokeStyle = SCREEN_SOFT; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = SCREEN_TEXT;
  ctx.font = `${Math.round(h * 0.028)}px sans-serif`;
  ctx.textAlign = "center";
  drawWrappedText(ctx, lot.poem, w / 2, cardY + h * 0.075, 22, h * 0.055, 3);

  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.024)}px sans-serif`;
  ctx.textAlign = "left";
  drawWrappedText(ctx, lot.interpretation, w * 0.16, h * 0.67, 34, h * 0.05, 4);
}

function drawAiLoading(ctx: CanvasRenderingContext2D) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("AI 深度解读", w / 2, h * 0.065);
  ctx.fillStyle = SCREEN_ACCENT;
  ctx.font = `${Math.round(h * 0.032)}px sans-serif`;
  ctx.fillText("AI 正在分析卦象...", w / 2, h * 0.48);
  ctx.fillStyle = SCREEN_SOFT;
  ctx.font = `${Math.round(h * 0.024)}px sans-serif`;
  ctx.fillText("结合问题与卦象深度推理", w / 2, h * 0.56);
}

function drawAiResult(ctx: CanvasRenderingContext2D, text: string) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("AI 深度解读", w / 2, h * 0.065);

  const pad = w * 0.06, contentY = h * 0.12;
  const contentH = h * 0.7;
  ctx.fillStyle = SCREEN_PANEL_ACTIVE;
  ctx.shadowColor = "rgba(80, 58, 122, 0.1)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.roundRect(pad, contentY, w - pad * 2, contentH, 8); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  ctx.fillStyle = SCREEN_TEXT;
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.textAlign = "left";
  drawFittedScreenText(ctx, text, {
    x: pad + w * 0.03,
    y: contentY + h * 0.055,
    maxWidth: w - pad * 2 - w * 0.06,
    maxHeight: contentH - h * 0.11,
    lineHeight: h * 0.034,
    overflowColor: SCREEN_MUTED,
    overflowText: "解读过长，已精简显示。",
    paragraphGap: h * 0.014,
  });

  // no hint — table click handles navigation
}

// ---- main component ----
export function IchingHexagram({
  lotResult,
  onLotResultClear,
}: {
  lotResult: LotResult | null;
  onLotResultClear: () => void;
}) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);

  const [phase, setPhase] = useState<"idle" | "question" | "casting" | "result">("idle");
  const [hovered, setHovered] = useState(false);
  const [round, setRound] = useState(0);
  const [lines, setLines] = useState<YaoValue[]>([]);
  const [result, setResult] = useState<IchingResult | null>(null);
  const [question, setQuestion] = useState("");
  const [revealPage, setRevealPage] = useState<"cards" | "ai_loading" | "ai_result">("cards");
  const [aiText, setAiText] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [isQuestionInputActive, setIsQuestionInputActive] = useState(false);
  const [hoveredQuestionControl, setHoveredQuestionControl] =
    useState<FortuneQuestionControl | null>(null);

  const hoveredRef = useRef(false);
  const coinRayRef = useRef<Mesh>(null!);
  const tableMeshRef = useRef<Mesh>(null!);
  const questionControlMeshesRef = useRef<
    Partial<Record<FortuneQuestionControl, Mesh>>
  >({});
  const hoveredTableRef = useRef(false);
  const hoveredQuestionControlRef = useRef<FortuneQuestionControl | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const roundTimerRef = useRef(0);
  const coinStatesRef = useRef<CoinState[][]>([]);
  const roundFinishedRef = useRef<boolean[]>([]);
  const currentCoinIndexRef = useRef(0);
  const coinAdvancePendingRef = useRef(false);
  const coinObjectRefs = useRef<(Object3D | null)[]>([]);
  const impactRingRefs = useRef<(Mesh | null)[]>([]);

  const gltf = useGLTF(COIN_URL);
  const coinModel = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const { canvas: offCanvas, texture: screenTex } = useMemo(createScreenCanvas, []);

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
    setPhase("idle");
  }, [setAimedQuestionControl]);

  const startCasting = useCallback((q: string) => {
    setQuestion(q);
    setQuestionDraft("");
    setIsQuestionInputActive(false);
    setAimedQuestionControl(null);
    setRevealPage("cards");
    setAiText("");
    setPhase("casting");
    setRound(0);
    setLines([]);
    setResult(null);
    onLotResultClear();
    roundTimerRef.current = 0;
    roundFinishedRef.current = Array.from({ length: ROUNDS }, () => false);
    currentCoinIndexRef.current = 0;
    coinAdvancePendingRef.current = false;
    coinObjectRefs.current = [];
    impactRingRefs.current = [];
    coinStatesRef.current = makeCastingPlan();
  }, [onLotResultClear, setAimedQuestionControl]);

  const confirmQuestion = useCallback(() => {
    startCasting(questionDraft.trim() || "未命名的问题");
  }, [questionDraft, startCasting]);

  useScreenTextInput({
    active: phase === "question" && isQuestionInputActive,
    ariaLabel: "周易起卦问题输入",
    onCancel: cancelQuestion,
    onChange: setQuestionDraft,
    onConfirm: confirmQuestion,
    value: questionDraft,
  });

  useEffect(() => {
    if (!lotResult) return;
    setQuestionDraft("");
    setIsQuestionInputActive(false);
    setAimedQuestionControl(null);
    setRevealPage("cards");
    setAiText("");
    setResult(null);
    setPhase("idle");
  }, [lotResult, setAimedQuestionControl]);

  // screen update
  useEffect(() => {
    const ctx = offCanvas.getContext("2d"); if (!ctx) return;
    if (revealPage === "ai_loading") drawAiLoading(ctx);
    else if (revealPage === "ai_result") drawAiResult(ctx, aiText);
    else if (phase === "question") drawQuestion(ctx, questionDraft, isQuestionInputActive, hoveredQuestionControl);
    else if (lotResult) drawLotResult(ctx, lotResult);
    else if (result) drawResult(ctx, result);
    else if (phase === "casting") drawCasting(ctx, round, lines);
    else drawIdle(ctx);
    screenTex.needsUpdate = true;
  }, [
    phase,
    round,
    lines,
    result,
    lotResult,
    offCanvas,
    screenTex,
    revealPage,
    aiText,
    questionDraft,
    isQuestionInputActive,
    hoveredQuestionControl,
  ]);

  // AI fetch
  useEffect(() => {
    if (revealPage !== "ai_loading" || !result || !question) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getIchingAiReading({
          question,
          originalHexagram: result.originalHexagram,
          changedHexagram: result.changedHexagram,
          changingLines: result.changingLines,
        });
        if (!cancelled) {
          setAiText(
            res.success && res.data
              ? res.data.interpretation
              : (res.error || "AI 解读暂时不可用，请稍后再试。"),
          );
          setRevealPage("ai_result");
        }
      } catch {
        if (!cancelled) {
          setAiText("AI 解读暂时不可用，请稍后再试。");
          setRevealPage("ai_result");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [revealPage, result, question]);

  // raycasting — coin hover in idle, table click in result
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
      if (hoveredRef.current) { hoveredRef.current = false; setHovered(false); }
      return;
    }
    if (phase === "result") {
      setAimedQuestionControl(null);
      const hits = tableMeshRef.current ? raycasterRef.current.intersectObject(tableMeshRef.current, false) : [];
      const h = hits.length > 0;
      if (hoveredTableRef.current !== h) { hoveredTableRef.current = h; }
      return;
    }
    if (phase === "idle") {
      setAimedQuestionControl(null);
      const hits = coinRayRef.current ? raycasterRef.current.intersectObject(coinRayRef.current, false) : [];
      const h = hits.length > 0;
      if (hoveredRef.current !== h) { hoveredRef.current = h; setHovered(h); }
    }
  });

  // casting animation
  useFrame((_, delta) => {
    if (phase !== "casting") return;
    roundTimerRef.current += delta;
    const roundTime = Math.min(roundTimerRef.current, COIN_TOSS_DURATION);
    const states = coinStatesRef.current[round];
    if (!states) return;
    const activeCoinIndex = currentCoinIndexRef.current;

    for (let ci = 0; ci < 3; ci++) {
      const s = states[ci];
      if (ci < activeCoinIndex) {
        settleCoinState(s);
        applyCoinVisual(coinObjectRefs.current[ci], s);
        applyImpactVisual(impactRingRefs.current[ci], s);
      } else if (ci === activeCoinIndex) {
        updateCoinState(s, roundTime);
        applyCoinVisual(coinObjectRefs.current[ci], s);
        applyImpactVisual(impactRingRefs.current[ci], s);
      } else {
        hideObject(coinObjectRefs.current[ci]);
        hideObject(impactRingRefs.current[ci]);
      }
    }

    const activeCoin = states[activeCoinIndex];
    if (!activeCoin || !activeCoin.done || coinAdvancePendingRef.current) return;

    if (activeCoinIndex < 2) {
      coinAdvancePendingRef.current = true;
      setTimeout(() => {
        currentCoinIndexRef.current = activeCoinIndex + 1;
        roundTimerRef.current = 0;
        coinAdvancePendingRef.current = false;
      }, COIN_GAP_MS);
      return;
    }

    if (states.every((s) => s.done) && !roundFinishedRef.current[round]) {
      roundFinishedRef.current[round] = true;
      const yao = yaoFromCoins(states);

      setLines((prev) => {
        const next = [...prev, yao];
        // last round done
        if (next.length >= ROUNDS) {
          const vals = next;
          const r: IchingResult = {
            lines: vals.map((v, i) => ({ position: i + 1, value: v, isChanging: isChangingLine(v), label: getYaoLabel(v) })),
            originalHexagram: lookUpHexagram(vals),
            changedHexagram: lookUpChangedHexagram(vals),
            changingLines: vals.map((v, i) => isChangingLine(v) ? i + 1 : -1).filter((p) => p > 0),
            summary: `${lookUpHexagram(vals).name} · ${lookUpHexagram(vals).description}`,
          };
          setTimeout(() => { setResult(r); setPhase("result"); }, RESULT_DELAY_MS);
        }
        return next;
      });

      // next round
      if (round < ROUNDS - 1) {
        coinAdvancePendingRef.current = true;
        setTimeout(() => {
          currentCoinIndexRef.current = 0;
          coinAdvancePendingRef.current = false;
          coinObjectRefs.current = [];
          impactRingRefs.current = [];
          setRound((r) => r + 1);
          roundTimerRef.current = 0;
        }, ROUND_GAP_MS);
      }
    }
  });

  // click handler
  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    if (phase !== "question" && document.pointerLockElement !== domElement) return;
    if (phase === "result" && hoveredTableRef.current) {
      consumeCanvasClick(event);
      setRevealPage((prev) => {
        if (prev === "cards") { setAiText(""); return "ai_loading"; }
        if (prev === "ai_result") return "cards";
        return prev;
      });
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
    if (phase !== "idle" || !hoveredRef.current) return;
    consumeCanvasClick(event);
    setQuestionDraft("");
    setIsQuestionInputActive(true);
    setAimedQuestionControl(null);
    onLotResultClear();
    setRevealPage("cards");
    setAiText("");
    setResult(null);
    setPhase("question");
  }, [
    cancelQuestion,
    closeQuestionInput,
    confirmQuestion,
    domElement,
    isQuestionInputActive,
    onLotResultClear,
    phase,
    setAimedQuestionControl,
  ]);

  useEffect(() => {
    domElement.addEventListener("click", handleClick);
    return () => domElement.removeEventListener("click", handleClick);
  }, [domElement, handleClick]);

  return (
    <group>
      {/* trigger — coin model with raycast overlay + hover glow */}
      {phase === "idle" && (
        <group position={TRIGGER_POS}>
          <primitive object={coinModel.clone(true)} scale={0.68} />
          {/* invisible raycast target matching coin shape */}
          <mesh ref={coinRayRef}>
            <cylinderGeometry args={[0.1, 0.1, 0.18, 12]} />
            <meshBasicMaterial visible={false} depthWrite={false} />
          </mesh>
          {hovered && (
            <pointLight color="#c9a84c" intensity={1.5} distance={2} />
          )}
        </group>
      )}

      {/* current casting round — one tossed coin at a time, previous coins stay flat */}
      {phase === "casting" && (
        <group key={`casting-${round}`}>
          {(coinStatesRef.current[round] ?? []).map((s, ci) => (
            <group key={ci}>
              <mesh
                ref={(mesh) => { impactRingRefs.current[ci] = mesh; }}
                position={[s.x, COIN_BASE_Y + 0.012, s.z]}
                rotation={[-Math.PI / 2, 0, 0]}
                visible={false}
              >
                <ringGeometry args={[0.09, 0.145, 48]} />
                <meshBasicMaterial
                  blending={AdditiveBlending}
                  color="#ffd977"
                  depthWrite={false}
                  opacity={0}
                  side={DoubleSide}
                  transparent
                />
              </mesh>
              <primitive
                key={ci}
                object={coinModel.clone(true)}
                ref={(object: Object3D | null) => { coinObjectRefs.current[ci] = object; }}
                position={[s.x, s.y, s.z]}
                rotation={[s.rx, s.ry, s.rz]}
                scale={COIN_SCALE}
                visible={ci === currentCoinIndexRef.current}
              />
            </group>
          ))}
        </group>
      )}

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

      {/* table click area for page flip (result phase) */}
      {phase === "result" && (
        <mesh ref={tableMeshRef} position={[6, 1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 1.2]} />
          <meshBasicMaterial
            depthTest={false}
            depthWrite={false}
            side={DoubleSide}
            visible={false}
          />
        </mesh>
      )}
    </group>
  );
}
