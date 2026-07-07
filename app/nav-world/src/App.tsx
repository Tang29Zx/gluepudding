import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { FallbackPage, type FallbackReason } from "./components/FallbackPage";
import { WorldExperience } from "./world/WorldExperience";

type RuntimeState = "checking" | "ready" | "fallback" | "error";

interface WorldErrorBoundaryProps {
  children: ReactNode;
  onWorldError: () => void;
}

interface WorldErrorBoundaryState {
  hasError: boolean;
}

// React error boundaries require class components.
class WorldErrorBoundary extends Component<
  WorldErrorBoundaryProps,
  WorldErrorBoundaryState
> {
  public state: WorldErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): WorldErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    console.warn("3D world unavailable; fallback page is active.");
    this.props.onWorldError();
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

function canCreateWebGLContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const canvas = document.createElement("canvas");
  const context =
    canvas.getContext("webgl2") ??
    canvas.getContext("webgl") ??
    canvas.getContext("experimental-webgl");

  return Boolean(context);
}

function shouldForceFallback(): boolean {
  if (import.meta.env.VITE_FORCE_WORLD_FALLBACK === "true") {
    return true;
  }

  return new URLSearchParams(window.location.search).has("forceFallback");
}

function getFallbackReason(runtimeState: RuntimeState): FallbackReason {
  if (runtimeState === "checking") {
    return "starting";
  }

  if (runtimeState === "error") {
    return "error";
  }

  return "webgl-unavailable";
}

function getInitialRuntimeState(): RuntimeState {
  if (shouldForceFallback() || !canCreateWebGLContext()) {
    return "fallback";
  }

  return "checking";
}

export function App() {
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(getInitialRuntimeState);

  if (runtimeState === "fallback" || runtimeState === "error") {
    return <FallbackPage reason={getFallbackReason(runtimeState)} />;
  }

  return (
    <>
      <WorldErrorBoundary onWorldError={() => setRuntimeState("error")}>
        <WorldExperience onReady={() => setRuntimeState("ready")} />
      </WorldErrorBoundary>
      {runtimeState === "checking" ? (
        <div className="startup-fallback" aria-hidden="false">
          <FallbackPage reason="starting" />
        </div>
      ) : null}
    </>
  );
}
