// ============================================================
// 周易占卜 — 3D 铜钱动画
// 6轮投掷，每轮3枚铜钱飞出旋转落地，累积六爻展示结果
// ============================================================

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  Raycaster,
  Vector2,
} from "three";
import {
  castHexagram,
  getYaoLabel,
  isChangingLine,
  isYang,
  lookUpChangedHexagram,
  lookUpHexagram,
} from "./business/ichingLogic";
import { getIchingAiReading } from "./fortuneApi";
import type { IchingLine, IchingResult, YaoValue } from "./types";

const screenCenter = new Vector2(0, 0);

// iching-coin model in tent local: positionOnIchingTable(0.48, 1.18, 0.22) → ~[5.78, 1.18, 0.48]
const COIN_URL = "./models/fortune/iching_coin.glb";
const TRIGGER_POS: [number, number, number] = [5.78, 1.28, 0.48];
const COIN_BASE_Y = 1.2;

// 6 yao positions (bottom-up, displayed near the table)
// Each yao level at a different Y
const YAO_START_Y = 1.25;
const YAO_GAP = 0.14;
const YAO_X = 5.78;
const YAO_Z = 0.48;

const ROUNDS = 6;
const ROUND_DURATION = 1.0;
const COIN_SPREAD = 0.22;

// coin result: 3=正面(yang), 2=反面(yin)
function coinResult(): 2 | 3 { return Math.random() < 0.5 ? 2 : 3; }

interface CoinState {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  done: boolean;
}

interface RoundState {
  coins: CoinState[];
  yao: YaoValue | null;
  done: boolean;
}

interface TouchTarget { x: number; y: number; h: number; w: number }

function initRound(round: number): RoundState {
  const baseY = YAO_START_Y + round * YAO_GAP;
  return {
    coins: [0, 1, 2].map((i) => ({
      x: YAO_X + (i - 1) * COIN_SPREAD,
      y: COIN_BASE_Y,
      z: YAO_Z,
      rx: 0, ry: 0, rz: 0,
      opacity: 1,
    })),
    yao: null,
    done: false,
  };
}

// ---- content screen ----
const SCREEN_POS: [number, number, number] = [7.45, 2.0, 0];
const SCREEN_ROT: [number, number, number] = [0, -Math.PI / 2, 0];
const SCREEN_W = 3.6; const SCREEN_H = 2.25;
const CANVAS_W = 1024; const CANVAS_H = 640;

function createScreenCanvas() {
  const c = document.createElement("canvas"); c.width = CANVAS_W; c.height = CANVAS_H;
  const t = new CanvasTexture(c); t.minFilter = 1006; t.magFilter = 1006;
  return { canvas: c, texture: t };
}

function drawIdle(ctx: CanvasRenderingContext2D) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f7f5fb"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a1436"; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = "#c9a84c"; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("I Ching · 周易占卜", w / 2, h * 0.065);
  ctx.fillStyle = "#999";
  ctx.font = `${Math.round(h * 0.028)}px sans-serif`;
  ctx.fillText("对准桌面上的铜钱开始起卦", w / 2, h * 0.48);
  ctx.fillStyle = "#c9a84c";
  ctx.beginPath(); ctx.arc(w / 2, h * 0.54, 3, 0, Math.PI * 2); ctx.fill();
}

function drawCasting(ctx: CanvasRenderingContext2D, round: number, lines: YaoValue[]) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f7f5fb"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a1436"; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = "#c9a84c"; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText(`第 ${round + 1} / 6 爻`, w / 2, h * 0.065);
  // show accumulated lines
  const lineY = h * 0.5;
  for (let i = 0; i < lines.length; i++) {
    const y = lineY - (lines.length - 1 - i) * h * 0.07;
    const v = lines[i];
    const isYin = v === 6 || v === 8;
    const chg = v === 6 || v === 9;
    ctx.fillStyle = chg ? "#c62828" : "#1a1436";
    ctx.font = `${Math.round(h * 0.026)}px sans-serif`;
    ctx.fillText(isYin ? "━  ╋  ━" : "━━━━━", w / 2, y);
    ctx.fillStyle = chg ? "#c62828" : "#888";
    ctx.font = `${Math.round(h * 0.018)}px sans-serif`;
    ctx.fillText(getYaoLabel(v), w / 2 + w * 0.12, y);
  }
  // current round indicator
  ctx.fillStyle = "#c9a84c";
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.fillText("铜钱投掷中...", w / 2, lineY + h * 0.08);
}

function drawResult(ctx: CanvasRenderingContext2D, result: IchingResult) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f7f5fb"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a1436"; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = "#c9a84c"; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("I Ching · 占卜结果", w / 2, h * 0.065);

  // hexagram display
  const orig = result.originalHexagram;
  const chg = result.changedHexagram;
  const hasChange = chg && result.changingLines.length > 0;

  ctx.fillStyle = "#1a1436";
  ctx.font = `500 ${Math.round(h * 0.045)}px sans-serif`;
  ctx.fillText(orig.symbol, w * 0.28, h * 0.22);
  ctx.font = `500 ${Math.round(h * 0.03)}px sans-serif`;
  ctx.fillText(orig.name, w * 0.28, h * 0.28);
  ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
  ctx.fillStyle = "#888";
  ctx.fillText(`第${orig.number}卦`, w * 0.28, h * 0.33);

  if (hasChange) {
    ctx.fillStyle = "#c9a84c"; ctx.font = `${Math.round(h * 0.025)}px sans-serif`;
    ctx.fillText("→", w * 0.5, h * 0.24);
    ctx.fillStyle = "#5d4db6";
    ctx.font = `500 ${Math.round(h * 0.045)}px sans-serif`;
    ctx.fillText(chg!.symbol, w * 0.72, h * 0.22);
    ctx.font = `500 ${Math.round(h * 0.03)}px sans-serif`;
    ctx.fillText(chg!.name, w * 0.72, h * 0.28);
    ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
    ctx.fillStyle = "#888";
    ctx.fillText(`第${chg!.number}卦`, w * 0.72, h * 0.33);
    ctx.fillStyle = "#c62828";
    ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
    ctx.fillText(`变爻：第${result.changingLines.join("、")}爻`, w / 2, h * 0.38);
  }

  // description
  ctx.fillStyle = "#666";
  ctx.font = `${Math.round(h * 0.024)}px sans-serif`;
  ctx.textAlign = "center";
  const desc = orig.description;
  const maxChars = 36;
  for (let i = 0; i < desc.length; i += maxChars) {
    ctx.fillText(desc.slice(i, i + maxChars), w / 2, h * 0.46 + (i / maxChars) * h * 0.04);
  }

  // summary
  ctx.fillStyle = "#1a1436";
  ctx.font = `500 ${Math.round(h * 0.025)}px sans-serif`;
  ctx.fillText("综合解读", w / 2, h * 0.58);
  ctx.fillStyle = "#666";
  ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
  for (let i = 0; i < result.summary.length; i += 40) {
    ctx.fillText(result.summary.slice(i, i + 40), w / 2, h * 0.62 + (i / 40) * h * 0.035);
  }

  // lines display
  const lineY = h * 0.78;
  ctx.fillStyle = "#5d4db6";
  ctx.font = `500 ${Math.round(h * 0.022)}px sans-serif`;
  ctx.fillText("六爻（从下往上）", w / 2, lineY);
  for (let li = 0; li < 6; li++) {
    const l = result.lines[li];
    const isYin = !isYang(l.value);
    const chgLine = l.isChanging;
    ctx.fillStyle = chgLine ? "#c62828" : "#1a1436";
    ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
    ctx.fillText(
      `${l.position}爻 ${isYin ? "━╋━" : "━━━"} ${l.label}`,
      w / 2,
      lineY + h * 0.04 + li * h * 0.032,
    );
  }

  // hint removed — use table click instead
}

function drawAiLoading(ctx: CanvasRenderingContext2D) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f7f5fb"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a1436"; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = "#c9a84c"; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("AI 深度解读", w / 2, h * 0.065);
  ctx.fillStyle = "#5d4db6";
  ctx.font = `${Math.round(h * 0.032)}px sans-serif`;
  ctx.fillText("AI 正在分析卦象...", w / 2, h * 0.48);
  ctx.fillStyle = "#e8e4f2";
  ctx.font = `${Math.round(h * 0.024)}px sans-serif`;
  ctx.fillText("结合问题与卦象深度推理", w / 2, h * 0.56);
}

function drawAiResult(ctx: CanvasRenderingContext2D, text: string) {
  const w = CANVAS_W, h = CANVAS_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f7f5fb"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1a1436"; ctx.fillRect(0, 0, w, h * 0.095);
  ctx.fillStyle = "#c9a84c"; ctx.fillRect(w * 0.3, h * 0.095, w * 0.4, 2);
  ctx.fillStyle = "#fff";
  ctx.font = `500 ${Math.round(h * 0.038)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText("AI 深度解读", w / 2, h * 0.065);

  const pad = w * 0.06, contentY = h * 0.12;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(90,77,182,0.08)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.roundRect(pad, contentY, w - pad * 2, h * 0.7, 8); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  ctx.fillStyle = "#444";
  ctx.font = `${Math.round(h * 0.022)}px sans-serif`;
  ctx.textAlign = "left";
  const maxChars = 48; const lineH = h * 0.035;
  const lines = text.split("\n").filter((l) => l.trim());
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    for (let i = 0; i < line.length; i += maxChars) {
      ctx.fillText(line.slice(i, i + maxChars), pad + w * 0.03, contentY + h * 0.025 + (li * 3 + (i / maxChars)) * lineH);
    }
  }

  // no hint — table click handles navigation
}

// ---- question overlay ----
function showQuestionOverlay(onConfirm: (q: string) => void, onCancel: () => void) {
  if (document.getElementById("iching-question-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "iching-question-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:999;background:rgba(0,0,0,0.55);cursor:default;";
  overlay.innerHTML = `<div style="background:#f7f5fb;border-radius:14px;padding:24px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
    <div style="font-size:18px;font-weight:500;color:#1a1436;margin-bottom:8px;">你想卜问什么？</div>
    <div style="font-size:13px;color:#888;margin-bottom:16px;">静心默念你的问题，六爻将揭示天机</div>
    <input id="iching-question-input" type="text" placeholder="例如：此行是否顺利？"
      style="width:100%;padding:10px 12px;border:1px solid #d3d1c7;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:16px;" autofocus />
    <div style="display:flex;gap:12px;justify-content:center;">
      <button id="iching-question-cancel" style="padding:8px 24px;border:1px solid #d3d1c7;border-radius:8px;background:#fff;color:#666;font-size:14px;cursor:pointer;">取消</button>
      <button id="iching-question-confirm" style="padding:8px 28px;border:none;border-radius:8px;background:#5d4db6;color:#fff;font-size:14px;cursor:pointer;font-weight:500;">开始起卦</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector("#iching-question-input") as HTMLInputElement;
  input.focus();
  overlay.querySelector("#iching-question-confirm")!.addEventListener("click", () => { const q = input.value.trim() || "未命名的问题"; overlay.remove(); onConfirm(q); });
  overlay.querySelector("#iching-question-cancel")!.addEventListener("click", () => { overlay.remove(); onCancel(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const q = input.value.trim() || "未命名的问题"; overlay.remove(); onConfirm(q); }
    if (e.key === "Escape") { overlay.remove(); onCancel(); }
  });
}

// ---- main component ----
export function IchingHexagram() {
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

  const meshRef = useRef<Mesh>(null!);
  const hoveredRef = useRef(false);
  const tableMeshRef = useRef<Mesh>(null!);
  const hoveredTableRef = useRef(false);
  const raycasterRef = useRef(new Raycaster());
  const roundTimerRef = useRef(0);
  const coinStatesRef = useRef<CoinState[][]>([]);

  const gltf = useGLTF(COIN_URL);
  const coinModel = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const { canvas: offCanvas, texture: screenTex } = useMemo(createScreenCanvas, []);

  // screen update
  useEffect(() => {
    const ctx = offCanvas.getContext("2d"); if (!ctx) return;
    if (revealPage === "ai_loading") drawAiLoading(ctx);
    else if (revealPage === "ai_result") drawAiResult(ctx, aiText);
    else if (result) drawResult(ctx, result);
    else if (phase === "casting") drawCasting(ctx, round, lines);
    else drawIdle(ctx);
    screenTex.needsUpdate = true;
  }, [phase, round, lines, result, offCanvas, screenTex, revealPage, aiText]);

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

  // raycasting
  useFrame(() => {
    raycasterRef.current.setFromCamera(screenCenter, camera);
    if (phase === "result") {
      const hits = tableMeshRef.current ? raycasterRef.current.intersectObject(tableMeshRef.current, false) : [];
      const h = hits.length > 0;
      if (hoveredTableRef.current !== h) { hoveredTableRef.current = h; }
      return;
    }
    if (phase !== "idle") {
      if (hoveredRef.current) { hoveredRef.current = false; setHovered(false); }
      return;
    }
    const hits = meshRef.current ? raycasterRef.current.intersectObject(meshRef.current, false) : [];
    const h = hits.length > 0;
    if (hoveredRef.current !== h) { hoveredRef.current = h; setHovered(h); }
  });

  // casting animation
  useFrame((_, delta) => {
    if (phase !== "casting") return;
    roundTimerRef.current += delta;
    const t = Math.min(roundTimerRef.current / ROUND_DURATION, 1);
    // ease-out: 1-(1-t)^3
    const easeOut = 1 - (1 - t) * (1 - t) * (1 - t);
    // ease-in-out blend
    const progress = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const states = coinStatesRef.current[round];
    if (!states) return;
    // spin speed peaks mid-flight
    const spinFactor = Math.sin(t * Math.PI);
    for (let ci = 0; ci < 3; ci++) {
      const s = states[ci];
      const arc = Math.sin(easeOut * Math.PI) * 0.55;
      s.y = COIN_BASE_Y + arc;
      s.rx += delta * (14 + ci * 3) * spinFactor;
      s.ry += delta * (10 + ci * 2) * spinFactor;
      s.rz += delta * (6 + ci * 4) * spinFactor;
    }

    if (t >= 1 && !states[0].done) {
      // compute yao value for this round
      const coins: (2 | 3)[] = [coinResult(), coinResult(), coinResult()];
      const yao = (coins[0] + coins[1] + coins[2]) as YaoValue;
      for (let ci = 0; ci < 3; ci++) { states[ci].done = true; }

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
          setTimeout(() => { setResult(r); setPhase("result"); }, 500);
        }
        return next;
      });

      // next round
      if (round < ROUNDS - 1) {
        setTimeout(() => { setRound((r) => r + 1); roundTimerRef.current = 0; }, 300);
      }
    }
  });

  // click handler
  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    if (document.pointerLockElement !== domElement) return;
    if (phase === "result" && hoveredTableRef.current) {
      event.preventDefault(); event.stopPropagation();
      setRevealPage((prev) => {
        if (prev === "cards") { setAiText(""); return "ai_loading"; }
        if (prev === "ai_result") return "cards";
        return prev;
      });
      return;
    }
    if (phase !== "idle" || !hoveredRef.current) return;
    event.preventDefault(); event.stopPropagation();
    document.exitPointerLock();
    setPhase("question");
    showQuestionOverlay(
      (q) => {
        setQuestion(q);
        setRevealPage("cards");
        setAiText("");
        setPhase("casting");
        setRound(0);
        setLines([]);
        setResult(null);
        roundTimerRef.current = 0;
        coinStatesRef.current = Array.from({ length: ROUNDS }, () =>
          [0, 1, 2].map((i) => ({ x: YAO_X + (i - 1) * COIN_SPREAD, y: COIN_BASE_Y, z: YAO_Z, rx: 0, ry: 0, rz: 0, done: false })),
        );
        setTimeout(() => domElement.requestPointerLock?.(), 150);
      },
      () => {
        setPhase("idle");
        setTimeout(() => domElement.requestPointerLock?.(), 150);
      },
    );
  }, [domElement, phase]);

  useEffect(() => {
    domElement.addEventListener("click", handleClick);
    return () => domElement.removeEventListener("click", handleClick);
  }, [domElement, handleClick]);

  return (
    <group>
      {/* trigger (visible coin hint) */}
      {phase === "idle" && (
        <>
          <mesh ref={meshRef} position={TRIGGER_POS}>
            <sphereGeometry args={[hovered ? 0.38 : 0.3, 16, 12]} />
            <meshStandardMaterial
              color={hovered ? "#c9a84c" : "#5d4db6"}
              emissive={hovered ? "#c9a84c" : "#5d4db6"}
              emissiveIntensity={hovered ? 0.55 : 0.2}
              roughness={0.3}
              transparent opacity={hovered ? 0.45 : 0.18}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {/* 3 coins per round, showing all completed rounds */}
      {phase === "casting" && Array.from({ length: Math.min(round + 1, ROUNDS) }, (_, r) => {
        const states = coinStatesRef.current[r];
        if (!states) return null;
        return (
          <group key={r}>
            {states.map((s, ci) => (
              <primitive
                key={ci}
                object={coinModel.clone(true)}
                position={[s.x, s.y, s.z]}
                rotation={[s.rx, s.ry, s.rz]}
                scale={0.58}
              />
            ))}
          </group>
        );
      })}

      {/* content screen */}
      <group position={SCREEN_POS} rotation={SCREEN_ROT}>
        <mesh receiveShadow>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial map={screenTex} side={DoubleSide} transparent opacity={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <boxGeometry args={[SCREEN_W + 0.1, SCREEN_H + 0.1, 0.035]} />
          <meshBasicMaterial color="#1a1436" transparent opacity={0.32} />
        </mesh>
      </group>

      {/* table click area for page flip (result phase) */}
      {phase === "result" && (
        <mesh ref={tableMeshRef} position={[6, 1.05, 0]}>
          <boxGeometry args={[1.8, 0.5, 1.5]} />
          <meshBasicMaterial
            color={hoveredTableRef.current ? "#c9a84c" : "#5d4db6"}
            transparent
            opacity={hoveredTableRef.current ? 0.3 : 0.1}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
