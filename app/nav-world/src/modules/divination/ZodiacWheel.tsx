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
  Mesh,
  Raycaster,
  RingGeometry,
  Vector2,
} from "three";
import { getZodiacFortune } from "./fortuneApi";
import type { ZodiacResult, ZodiacSign } from "./types";
import { ZODIAC_SIGN_NAMES } from "./types";

const screenCenter = new Vector2(0, 0);

const ZODIAC_SIGNS: ZodiacSign[] = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

const SEGMENT_COUNT = 12;
const SEGMENT_ANGLE = (Math.PI * 2) / SEGMENT_COUNT;
const RING_INNER = 0.45;
const RING_OUTER = 1.65;
const RING_Y = 0.04; // slight lift above wheel surface (~0.51 + 0.04 ≈ 0.55)

const WHEEL_POS: [number, number, number] = [-6, 0.51 + RING_Y, 0];

const SCREEN_POSITION: [number, number, number] = [-7.45, 2.0, 0];
const SCREEN_ROTATION: [number, number, number] = [0, Math.PI / 2, 0];
const CANVAS_W = 512;
const CANVAS_H = 320;

/** shared offscreen canvas + texture, rebuilt on hot reload but stable otherwise */
function createScreenTexture(): { canvas: HTMLCanvasElement; texture: CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const texture = new CanvasTexture(canvas);
  texture.minFilter = 1006;
  texture.magFilter = 1006;
  return { canvas, texture };
}

// ---- canvas drawing helpers ----

function drawIdle(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#f8f7ff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#5d4db6";
  ctx.fillRect(0, 0, CANVAS_W, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("星座运势", CANVAS_W / 2, 32);
  ctx.fillStyle = "#999";
  ctx.font = "14px sans-serif";
  ctx.fillText("对准轮盘点击查看运势", CANVAS_W / 2, CANVAS_H / 2);
}

function drawLoading(ctx: CanvasRenderingContext2D, signName: string): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#f8f7ff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#5d4db6";
  ctx.fillRect(0, 0, CANVAS_W, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(signName, CANVAS_W / 2, 32);
  ctx.fillStyle = "#888";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("正在解读星象...", CANVAS_W / 2, CANVAS_H / 2);
}

function drawError(ctx: CanvasRenderingContext2D, message: string): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#fff5f5";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#c62828";
  ctx.fillRect(0, 0, CANVAS_W, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("运势查询失败", CANVAS_W / 2, 32);
  ctx.fillStyle = "#888";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(message, CANVAS_W / 2, CANVAS_H / 2);
}

function drawResult(ctx: CanvasRenderingContext2D, result: ZodiacResult): void {
  const w = CANVAS_W;
  const h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f8f7ff";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#5d4db6";
  ctx.fillRect(0, 0, w, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${result.signName} · ${result.date}`, w / 2, 32);

  const isGood = result.level.includes("吉");
  ctx.fillStyle = isGood ? "#e8f5e9" : "#fbe9e7";
  ctx.beginPath();
  ctx.roundRect(w / 2 - 36, 60, 72, 28, 14);
  ctx.fill();
  ctx.fillStyle = isGood ? "#2e7d32" : "#c62828";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(result.level, w / 2, 80);

  const scores: { label: string; value: number; color: string }[] = [
    { label: "综合", value: result.overall, color: "#7c6fd3" },
    { label: "爱情", value: result.love, color: "#e06ba0" },
    { label: "事业", value: result.career, color: "#4da6d9" },
    { label: "健康", value: result.health, color: "#5dc27a" },
  ];
  const barStartY = 104;
  const barGap = 34;
  const barMaxW = w - 120;
  scores.forEach((s, i) => {
    const y = barStartY + i * barGap;
    ctx.fillStyle = "#444";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(s.label, 68, y + 14);
    ctx.fillStyle = "#e8e5f2";
    ctx.fillRect(80, y + 4, barMaxW, 18);
    const fillW = (barMaxW * s.value) / 100;
    ctx.fillStyle = s.color;
    ctx.fillRect(80, y + 4, fillW, 18);
    ctx.fillStyle = "#333";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${s.value}`, 80 + fillW + 8, y + 18);
  });

  const luckyY = barStartY + 4 * barGap + 8;
  const luckyItems = [
    { label: "幸运色", value: result.luckyColor },
    { label: "幸运数字", value: `${result.luckyNumber}` },
    { label: "宜", value: result.good },
    { label: "忌", value: result.bad },
  ];
  luckyItems.forEach((item, i) => {
    const x = 24 + (w - 48) * (i / luckyItems.length);
    ctx.fillStyle = "#5d4db6";
    ctx.font = "12px sans-serif";
    ctx.fillText(item.label, x, luckyY);
    ctx.fillStyle = "#333";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(item.value, x, luckyY + 18);
  });

  const summaryY = luckyY + 48;
  ctx.fillStyle = "#666";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  const maxChars = 32;
  for (let i = 0; i < result.summary.length; i += maxChars) {
    ctx.fillText(result.summary.slice(i, i + maxChars), w / 2, summaryY + (i / maxChars) * 17);
  }
}

// ---- ring segment geometry shared across all 12 signs ----
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

// ---- main component ----

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

  // draw idle state once
  useEffect(() => {
    const ctx = offscreenCanvas.getContext("2d");
    if (ctx) {
      drawIdle(ctx);
      screenTexture.needsUpdate = true;
    }
  }, [offscreenCanvas, screenTexture]);

  // update canvas on state change
  useEffect(() => {
    const ctx = offscreenCanvas.getContext("2d");
    if (!ctx) return;

    if (status === "loading" && hoveredSign) {
      drawLoading(ctx, ZODIAC_SIGN_NAMES[hoveredSign]);
    } else if (status === "error") {
      drawError(ctx, errorMessage);
    } else if (result) {
      drawResult(ctx, result);
    }
    screenTexture.needsUpdate = true;
  }, [result, status, errorMessage, hoveredSign, offscreenCanvas, screenTexture]);

  // raycasting every frame
  useFrame(() => {
    raycasterRef.current.setFromCamera(screenCenter, camera);
    const meshes = Array.from(signMeshMapRef.current.entries());
    const objects = meshes.map(([, m]) => m);
    const intersections = raycasterRef.current.intersectObjects(objects, false);

    if (intersections.length > 0) {
      const hit = meshes.find(([, m]) => m === (intersections[0].object as Mesh));
      if (hit) {
        if (hoveredSignRef.current !== hit[0]) {
          hoveredSignRef.current = hit[0];
          setHoveredSign(hit[0]);
        }
        return;
      }
    }
    if (hoveredSignRef.current !== null) {
      hoveredSignRef.current = null;
      setHoveredSign(null);
    }
  });

  // click
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (document.pointerLockElement !== domElement) return;
      const sign = hoveredSignRef.current;
      if (!sign) return;
      event.preventDefault();
      event.stopPropagation();

      setStatus("loading");
      setErrorMessage("");
      getZodiacFortune({ sign })
        .then((res) => {
          if (res.success && res.data) {
            setResult(res.data);
            setStatus("idle");
          } else {
            throw new Error(res.error || "查询失败");
          }
        })
        .catch((err) => {
          setErrorMessage(err instanceof Error ? err.message : "网络错误");
          setStatus("error");
        });
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
      {/* 12 ring segments overlaying the wheel */}
      {ZODIAC_SIGNS.map((sign, index) => (
        <ZodiacSegment
          key={sign}
          sign={sign}
          index={index}
          isHovered={hoveredSign === sign}
          meshRef={registerMesh}
        />
      ))}

      {/* thin outer rim glow for visual reference */}
      <mesh
        position={WHEEL_POS}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[RING_OUTER - 0.04, RING_OUTER, 64]} />
        <meshBasicMaterial color="#a99bea" opacity={0.25} transparent depthWrite={false} />
      </mesh>

      {/* content screen */}
      <group position={SCREEN_POSITION} rotation={SCREEN_ROTATION}>
        <mesh receiveShadow>
          <planeGeometry args={[2.45, 1.55]} />
          <meshBasicMaterial
            map={screenTexture}
            side={DoubleSide}
            transparent
            opacity={0.95}
          />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <boxGeometry args={[2.55, 1.65, 0.035]} />
          <meshBasicMaterial color="#7c6fd3" transparent opacity={0.32} />
        </mesh>
      </group>
    </group>
  );
}
