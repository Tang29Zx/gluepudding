// ============================================================
// 星座轮盘 — 3D 交互组件
// 在 zodiac wheel 模型上方覆盖 12 个环形扇区，
// 准星命中后高亮对应扇区，左键点击查询运势并显示在内容屏上。
// ============================================================

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  Raycaster,
  RingGeometry,
  SRGBColorSpace,
  Vector2,
} from "three";
import { consumeCanvasClick } from "./canvasEvents";
import { getZodiacFortune } from "./fortuneApi";
import type { ZodiacResult, ZodiacSign } from "./types";
import { ZODIAC_SIGN_NAMES } from "./types";

const screenCenter = new Vector2(0, 0);

const ZODIAC_SIGNS: ZodiacSign[] = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

const SEGMENT_COUNT = 12;
const SEGMENT_ANGLE = (Math.PI * 2) / SEGMENT_COUNT;
const RING_INNER = 0.45;
const RING_OUTER = 1.65;
const RING_Y = 0.04;

const WHEEL_POS: [number, number, number] = [-6, 0.51 + RING_Y, 0];

const SCREEN_POSITION: [number, number, number] = [-7.45, 3.125, 0];
const SCREEN_ROTATION: [number, number, number] = [0, Math.PI / 2, 0];
const SCREEN_W = 7.2;
const SCREEN_H = 4.5;
const CANVAS_W = 1536;
const CANVAS_H = 960;
const SCREEN_BG = "#ded4e6";
const SCREEN_DARK = "#1d102f";
const SCREEN_ACCENT = "#6754a8";
const SCREEN_GOLD = "#b99d53";
const SCREEN_SOFT = "#cbbfd8";
const SCREEN_TEXT = "#2c203b";
const SCREEN_MUTED = "#756a82";
const SCREEN_HEADER_TEXT = "#f5eef9";
const SCREEN_GOOD_BG = "#d9e8d7";
const SCREEN_GOOD_TEXT = "#346f47";
const SCREEN_WARN_BG = "#ecd8d4";
const SCREEN_WARN_TEXT = "#914841";
const SCREEN_ERROR_BG = "#e8d7dd";

function createScreenTexture(): { canvas: HTMLCanvasElement; texture: CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = SRGBColorSpace;
  return { canvas, texture };
}

// ---- canvas drawing helpers (relative layout, auto-scales with canvas size) ----

function drawIdle(ctx: CanvasRenderingContext2D): void {
  const w = CANVAS_W, h = CANVAS_H, topH = h * 0.1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, topH - 2, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.04)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("星座运势", w / 2, topH * 0.66);
  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.035)}px sans-serif`;
  ctx.fillText("对准轮盘点击查看运势", w / 2, h * 0.52);
}

function drawLoading(ctx: CanvasRenderingContext2D, signName: string): void {
  const w = CANVAS_W, h = CANVAS_H, topH = h * 0.1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, topH - 2, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.04)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(signName, w / 2, topH * 0.66);
  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.035)}px sans-serif`;
  ctx.fillText("正在解读星象...", w / 2, h * 0.52);
}

function drawError(ctx: CanvasRenderingContext2D, message: string): void {
  const w = CANVAS_W, h = CANVAS_H, topH = h * 0.1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_ERROR_BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_WARN_TEXT; ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("运势查询失败", w / 2, topH * 0.66);
  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.032)}px sans-serif`;
  ctx.fillText(message, w / 2, h * 0.52);
}

function drawResult(ctx: CanvasRenderingContext2D, result: ZodiacResult): void {
  const w = CANVAS_W, h = CANVAS_H, topH = h * 0.1;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = SCREEN_BG; ctx.fillRect(0, 0, w, h);

  // top bar
  ctx.fillStyle = SCREEN_DARK; ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = SCREEN_GOLD; ctx.fillRect(w * 0.3, topH - 2, w * 0.4, 2);
  ctx.fillStyle = SCREEN_HEADER_TEXT;
  ctx.font = `500 ${Math.round(h * 0.04)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`${result.signName} · ${result.date}`, w / 2, topH * 0.66);

  // level badge
  const isGood = result.level.includes("吉");
  const badgeW = w * 0.12, badgeH = h * 0.06;
  ctx.fillStyle = isGood ? SCREEN_GOOD_BG : SCREEN_WARN_BG;
  ctx.beginPath();
  ctx.roundRect(w / 2 - badgeW / 2, h * 0.14, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.fillStyle = isGood ? SCREEN_GOOD_TEXT : SCREEN_WARN_TEXT;
  ctx.font = `500 ${Math.round(h * 0.034)}px sans-serif`;
  ctx.fillText(result.level, w / 2, h * 0.14 + badgeH * 0.7);

  // score bars
  const scores = [
    { label: "综合", value: result.overall, color: "#8171c5" },
    { label: "爱情", value: result.love, color: "#d982aa" },
    { label: "事业", value: result.career, color: "#6caed2" },
    { label: "健康", value: result.health, color: "#72b989" },
  ];
  const barStartY = h * 0.24, barGap = h * 0.08, barH = h * 0.042;
  const barMargin = w * 0.12, barMaxW = w - barMargin * 2;

  scores.forEach((s, i) => {
    const y = barStartY + i * barGap;
    ctx.fillStyle = SCREEN_TEXT;
    ctx.font = `${Math.round(h * 0.027)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(s.label, barMargin * 0.82, y + barH * 0.82);
    ctx.fillStyle = SCREEN_SOFT;
    ctx.fillRect(barMargin, y, barMaxW, barH);
    const fillW = (barMaxW * s.value) / 100;
    ctx.fillStyle = s.color;
    ctx.fillRect(barMargin, y, fillW, barH);
    ctx.fillStyle = SCREEN_TEXT;
    ctx.font = `500 ${Math.round(h * 0.028)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`${s.value}`, barMargin + fillW + 8, y + barH * 0.82);
  });

  // lucky info
  const luckyY = barStartY + 4 * barGap + h * 0.02;
  const luckyItems = [
    { label: "幸运色", value: result.luckyColor },
    { label: "幸运数字", value: `${result.luckyNumber}` },
    { label: "宜", value: result.good },
    { label: "忌", value: result.bad },
  ];
  luckyItems.forEach((item, i) => {
    const x = w * 0.06 + w * 0.88 * (i / luckyItems.length);
    ctx.fillStyle = SCREEN_ACCENT;
    ctx.font = `${Math.round(h * 0.027)}px sans-serif`;
    ctx.fillText(item.label, x, luckyY);
    ctx.fillStyle = SCREEN_TEXT;
    ctx.font = `500 ${Math.round(h * 0.03)}px sans-serif`;
    ctx.fillText(item.value, x, luckyY + h * 0.042);
  });

  // summary
  const summaryY = luckyY + h * 0.12;
  ctx.fillStyle = SCREEN_MUTED;
  ctx.font = `${Math.round(h * 0.025)}px sans-serif`;
  ctx.textAlign = "center";
  const maxChars = 36;
  for (let i = 0; i < result.summary.length; i += maxChars) {
    ctx.fillText(result.summary.slice(i, i + maxChars), w / 2, summaryY + (i / maxChars) * h * 0.04);
  }
}

// ---- ring segment geometry ----

function makeSegmentGeo(index: number): RingGeometry {
  const start = SEGMENT_ANGLE * index - Math.PI / 2;
  return new RingGeometry(RING_INNER, RING_OUTER, 6, 1, start, SEGMENT_ANGLE);
}

interface ZodiacSegmentProps {
  sign: ZodiacSign;
  index: number;
  isHovered: boolean;
  meshRef: (sign: ZodiacSign, mesh: Mesh | null) => void;
}

function ZodiacSegment({ sign, index, isHovered, meshRef }: ZodiacSegmentProps) {
  const geo = useMemo(() => makeSegmentGeo(index), [index]);
  return (
    <mesh
      ref={(m) => meshRef(sign, m)}
      geometry={geo}
      position={WHEEL_POS}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <meshBasicMaterial
        color={isHovered ? "#c1b3f0" : "#7c6fd3"}
        opacity={isHovered ? 0.45 : 0.12}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ---- main ----

export function ZodiacWheel() {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const raycasterRef = useRef(new Raycaster());
  const signMeshMapRef = useRef<Map<ZodiacSign, Mesh>>(new Map());
  const hoveredSignRef = useRef<ZodiacSign | null>(null);

  const [hoveredSign, setHoveredSign] = useState<ZodiacSign | null>(null);
  const [result, setResult] = useState<ZodiacResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const { canvas: offscreenCanvas, texture: screenTexture } = useMemo(
    () => createScreenTexture(),
    [],
  );

  useEffect(() => {
    const ctx = offscreenCanvas.getContext("2d");
    if (ctx) { drawIdle(ctx); screenTexture.needsUpdate = true; }
  }, [offscreenCanvas, screenTexture]);

  useEffect(() => {
    const ctx = offscreenCanvas.getContext("2d");
    if (!ctx) return;
    if (status === "loading" && hoveredSign) drawLoading(ctx, ZODIAC_SIGN_NAMES[hoveredSign]);
    else if (status === "error") drawError(ctx, errorMessage);
    else if (result) drawResult(ctx, result);
    screenTexture.needsUpdate = true;
  }, [result, status, errorMessage, hoveredSign, offscreenCanvas, screenTexture]);

  useFrame(() => {
    raycasterRef.current.setFromCamera(screenCenter, camera);
    const meshes = Array.from(signMeshMapRef.current.entries());
    const objects = meshes.map(([, m]) => m);
    const intersections = raycasterRef.current.intersectObjects(objects, false);
    if (intersections.length > 0) {
      const hit = meshes.find(([, m]) => m === (intersections[0].object as Mesh));
      if (hit && hoveredSignRef.current !== hit[0]) {
        hoveredSignRef.current = hit[0];
        setHoveredSign(hit[0]);
      }
    } else if (hoveredSignRef.current !== null) {
      hoveredSignRef.current = null;
      setHoveredSign(null);
    }
  });

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (document.pointerLockElement !== domElement) return;
      const sign = hoveredSignRef.current;
      if (!sign) return;
      consumeCanvasClick(event);
      setStatus("loading");
      setErrorMessage("");
      getZodiacFortune({ sign })
        .then((res) => {
          if (res.success && res.data) { setResult(res.data); setStatus("idle"); }
          else throw new Error(res.error || "查询失败");
        })
        .catch((err) => { setErrorMessage(err instanceof Error ? err.message : "网络错误"); setStatus("error"); });
    },
    [domElement],
  );

  useEffect(() => {
    domElement.addEventListener("click", handleClick);
    return () => domElement.removeEventListener("click", handleClick);
  }, [domElement, handleClick]);

  const registerMesh = useCallback((sign: ZodiacSign, mesh: Mesh | null) => {
    if (mesh) signMeshMapRef.current.set(sign, mesh);
    else signMeshMapRef.current.delete(sign);
  }, []);

  return (
    <group>
      {ZODIAC_SIGNS.map((sign, index) => (
        <ZodiacSegment key={sign} sign={sign} index={index}
          isHovered={hoveredSign === sign} meshRef={registerMesh} />
      ))}
      <mesh position={WHEEL_POS} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RING_OUTER - 0.04, RING_OUTER, 64]} />
        <meshBasicMaterial color="#a99bea" opacity={0.25} transparent depthWrite={false} />
      </mesh>
      <group position={SCREEN_POSITION} rotation={SCREEN_ROTATION}>
        <mesh receiveShadow>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial map={screenTexture} side={DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
