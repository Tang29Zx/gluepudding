import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { CameraRig } from "./CameraRig";
import { WorldScene } from "./WorldScene";
import { cameraConfig, worldColors } from "./sceneConfig";

interface WorldExperienceProps {
  onReady: () => void;
}

export function WorldExperience({ onReady }: WorldExperienceProps) {
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
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(worldColors.sky);
          onReady();
        }}
        shadows
      >
        <Suspense fallback={null}>
          <CameraRig />
          <WorldScene />
        </Suspense>
      </Canvas>

      <div className="world-hud" aria-label="3D 世界状态">
        <a className="world-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            3D
          </span>
          <span>gluepudding 3D World</span>
        </a>
        <div className="world-status">
          <span>Layer 1</span>
          <strong>WebGL Active</strong>
        </div>
      </div>
    </main>
  );
}
