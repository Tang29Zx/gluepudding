import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { CameraRig } from "./CameraRig";
import {
  getInteractionTargetById,
  type ActiveInteractionPanel,
  type InteractionTargetId,
} from "./InteractionSystem";
import { usePlayerController } from "./PlayerController";
import { WorldScene } from "./WorldScene";
import { cameraConfig, worldColors } from "./sceneConfig";

interface WorldExperienceProps {
  onReady: () => void;
}

const worldCanvasSelector = ".world-canvas canvas";

interface WorldRuntimeProps {
  activePanel: ActiveInteractionPanel | null;
  onActivateArea: (targetId: InteractionTargetId) => void;
  onAimedTargetChange: (targetId: InteractionTargetId | null) => void;
  onNearestTargetChange: (targetId: InteractionTargetId | null) => void;
  onSelectObject: (targetId: InteractionTargetId) => void;
  selectedTargetId: InteractionTargetId | null;
}

function WorldRuntime({
  activePanel,
  onActivateArea,
  onAimedTargetChange,
  onNearestTargetChange,
  onSelectObject,
  selectedTargetId,
}: WorldRuntimeProps) {
  const player = usePlayerController({ isMovementEnabled: !activePanel });

  return (
    <>
      <CameraRig player={player} />
      <WorldScene
        isPanelOpen={Boolean(activePanel)}
        onActivateArea={onActivateArea}
        onAimedTargetChange={onAimedTargetChange}
        onNearestTargetChange={onNearestTargetChange}
        onSelectObject={onSelectObject}
        player={player}
        selectedTargetId={selectedTargetId}
      />
    </>
  );
}

function restoreWorldCanvasFocus() {
  const canvas = document.querySelector<HTMLCanvasElement>(worldCanvasSelector);

  if (!canvas) {
    return;
  }

  canvas.focus({ preventScroll: true });

  if (
    document.pointerLockElement === canvas ||
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }

  try {
    void Promise.resolve(canvas.requestPointerLock()).catch(() => {
      console.warn("Pointer lock unavailable; 3D world remains active.");
    });
  } catch {
    console.warn("Pointer lock unavailable; 3D world remains active.");
  }
}

export function WorldExperience({ onReady }: WorldExperienceProps) {
  const [activePanel, setActivePanel] =
    useState<ActiveInteractionPanel | null>(null);
  const [aimedTargetId, setAimedTargetId] =
    useState<InteractionTargetId | null>(null);
  const [nearestTargetId, setNearestTargetId] =
    useState<InteractionTargetId | null>(null);
  const [selectedTargetId, setSelectedTargetId] =
    useState<InteractionTargetId | null>(null);

  const activePanelTarget = getInteractionTargetById(activePanel?.targetId ?? null);
  const aimedTarget = getInteractionTargetById(aimedTargetId);
  const nearestTarget = getInteractionTargetById(nearestTargetId);
  const selectedTarget = getInteractionTargetById(selectedTargetId);
  const selectableTarget = aimedTarget ?? nearestTarget;

  const openAreaPanel = useCallback((targetId: InteractionTargetId) => {
    setActivePanel({ mode: "area", targetId });
  }, []);

  const selectObject = useCallback((targetId: InteractionTargetId) => {
    setSelectedTargetId(targetId);
    setActivePanel({ mode: "object", targetId });
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const closePanelAndRestoreFocus = useCallback(() => {
    flushSync(() => {
      setActivePanel(null);
    });
    restoreWorldCanvasFocus();
  }, []);

  const interactionLines = useMemo(() => {
    if (activePanelTarget) {
      return ["移动输入已暂停，世界仍会继续运行。关闭面板后回到同一个世界位置。"];
    }

    if (!nearestTarget && !aimedTarget) {
      return ["移动到区域附近按 E 进入；准星对准对象后用左键选择。"];
    }

    const lines: string[] = [];

    if (nearestTarget) {
      lines.push(nearestTarget.areaPrompt);
    }

    if (aimedTarget && aimedTarget.id !== nearestTarget?.id) {
      lines.push(aimedTarget.objectPrompt);
    } else if (aimedTarget) {
      lines.push(aimedTarget.objectPrompt);
    }

    return lines;
  }, [activePanelTarget, aimedTarget, nearestTarget]);

  useEffect(() => {
    if (!activePanel) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape") {
        return;
      }

      event.preventDefault();
      closePanel();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel, closePanel]);

  return (
    <main className="world-shell" aria-label="gluepudding 3D World">
      <Canvas
        className="world-canvas"
        camera={{
          far: cameraConfig.far,
          fov: cameraConfig.fov,
          near: cameraConfig.near,
          position: cameraConfig.position,
        }}
        tabIndex={0}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(worldColors.sky);
          gl.domElement.tabIndex = 0;
          onReady();
        }}
        shadows
      >
        <Suspense fallback={null}>
          <WorldRuntime
            activePanel={activePanel}
            onActivateArea={openAreaPanel}
            onAimedTargetChange={setAimedTargetId}
            onNearestTargetChange={setNearestTargetId}
            onSelectObject={selectObject}
            selectedTargetId={selectedTargetId}
          />
        </Suspense>
      </Canvas>

      <div className="world-hud" aria-label="3D 世界状态">
        <div className="world-status">
          <span>Layer 3</span>
          <strong>{activePanel ? "Interaction Paused" : "Interaction Active"}</strong>
        </div>
      </div>

      <div
        aria-label={aimedTarget ? `准星对准：${aimedTarget.label}` : "中心准星"}
        className={`world-crosshair${aimedTarget ? " is-aimed" : ""}`}
      />

      <div className="world-interaction-bar" aria-live="polite">
        <div>
          {interactionLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        {selectedTarget ? (
          <strong>当前选中：{selectedTarget.label}</strong>
        ) : null}
      </div>

      <div className="world-touch-actions" aria-label="移动端交互操作">
        <button
          disabled={Boolean(activePanel) || !nearestTarget}
          onClick={() => {
            if (nearestTarget) {
              openAreaPanel(nearestTarget.id);
            }
          }}
          type="button"
        >
          Interact
        </button>
        <button
          disabled={Boolean(activePanel) || !selectableTarget}
          onClick={() => {
            if (selectableTarget) {
              selectObject(selectableTarget.id);
            }
          }}
          type="button"
        >
          Select
        </button>
      </div>

      {activePanel && activePanelTarget ? (
        <section
          aria-labelledby="world-panel-title"
          aria-modal="true"
          className="world-panel"
          role="dialog"
        >
          <p className="world-panel-kicker">
            {activePanel.mode === "area" ? "Area Interaction" : "Object Selected"}
          </p>
          <h2 id="world-panel-title">{activePanelTarget.panelTitle}</h2>
          <p>{activePanelTarget.panelBody}</p>
          <dl>
            <div>
              <dt>目标</dt>
              <dd>{activePanelTarget.label}</dd>
            </div>
            <div>
              <dt>触发方式</dt>
              <dd>{activePanel.mode === "area" ? "E / Interact" : "左键 / Select"}</dd>
            </div>
          </dl>
          <button onClick={closePanelAndRestoreFocus} type="button">
            关闭面板
          </button>
        </section>
      ) : null}
    </main>
  );
}
