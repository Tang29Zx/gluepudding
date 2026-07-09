import { useEffect, useRef } from "react";

interface GameOverlayProps {
  onClose: () => void;
}

export function GameOverlay({ onClose }: GameOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Exit pointer lock so iframe gets mouse events
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="game-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          background: "rgba(20,20,40,0.95)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          color: "#fff",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: "bold" }}>
          🎮 视角塑影师
        </span>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            padding: "6px 18px",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ✕ 退出 (ESC)
        </button>
      </div>

      {/* Game iframe */}
      <iframe
        src="/game/shadow-game.html"
        title="视角塑影师"
        style={{
          width: "100%",
          maxWidth: 1100,
          height: "calc(100vh - 100px)",
          border: "none",
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
        }}
        allow="autoplay"
      />
    </div>
  );
}
