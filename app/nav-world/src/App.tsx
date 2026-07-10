import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  preloadStartupAssets,
  type StartupAssetProgress,
} from "./assets/startupAssetPreloader";
import { FallbackPage, type FallbackReason } from "./components/FallbackPage";

type RuntimeState = "checking" | "ready" | "fallback" | "error";

const worldStartupTimeoutMs = 3 * 60 * 1000;
const worldDownloadTimeoutMs = 5 * 60 * 1000;
const startupInitialProgress = 8;
const startupDownloadSoftTarget = 88;
const startupDownloadTarget = 98;
const startupInitializeTarget = 99;

interface WorldExperienceProps {
  onReady: () => void;
}

type WorldLoadState =
  | { status: "loading" }
  | { status: "loaded"; Component: ComponentType<WorldExperienceProps> }
  | { status: "failed" };

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

function getStartupLabel(
  worldLoadState: WorldLoadState,
  assetProgress: StartupAssetProgress | null,
  progress: number,
): string {
  if (worldLoadState.status === "loading") {
    if (assetProgress?.currentLabel) {
      return `正在下载：${assetProgress.currentLabel}`;
    }

    if (progress >= startupDownloadSoftTarget) {
      return "仍在下载出生点可见资源";
    }

    return "正在下载出生点可见资源";
  }

  if (worldLoadState.status === "failed") {
    return "出生点可见资源加载失败";
  }

  return "正在解析并挂载可见世界";
}

function StartupScreen({
  assetProgress,
  hasFailed,
  label,
  onRetry,
  progress,
}: {
  assetProgress: StartupAssetProgress | null;
  hasFailed: boolean;
  label: string;
  onRetry: () => void;
  progress: number;
}) {
  const roundedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const assetProgressText = assetProgress
    ? `${assetProgress.completed}/${assetProgress.total} · ${formatBytes(assetProgress.bytesLoaded)}/${formatBytes(assetProgress.bytesTotal)}`
    : null;

  return (
    <div className="startup-screen" role="status" aria-live="polite">
      <span className="startup-mark" aria-hidden="true" />
      <span>{label}</span>
      <div
        className="startup-progress"
        role="progressbar"
        aria-label="3D world loading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedProgress}
      >
        <span style={{ width: `${roundedProgress}%` }} />
      </div>
      <span className="startup-progress-text">{roundedProgress}%</span>
      <span className="startup-note">
        {hasFailed
          ? "出生点可见资源加载失败，请检查网络后重试。"
          : assetProgressText
            ? `正在加载出生点可见资源 ${assetProgressText}`
            : "正在准备出生点可见资源。"}
      </span>
      {hasFailed ? (
        <button className="startup-retry" onClick={onRetry} type="button">
          重新加载
        </button>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 MB";
  }

  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

export function App() {
  const [runtimeState, setRuntimeState] =
    useState<RuntimeState>(getInitialRuntimeState);
  const [worldLoadState, setWorldLoadState] = useState<WorldLoadState>({
    status: "loading",
  });
  const [startupProgress, setStartupProgress] = useState(
    startupInitialProgress,
  );
  const [startupAssetProgress, setStartupAssetProgress] =
    useState<StartupAssetProgress | null>(null);
  const [downloadAttempt, setDownloadAttempt] = useState(0);

  useEffect(() => {
    if (runtimeState !== "checking") {
      return undefined;
    }

    let isCancelled = false;
    let hasSettled = false;
    const abortController = new AbortController();

    const downloadTimeoutId = window.setTimeout(() => {
      if (!isCancelled && !hasSettled) {
        hasSettled = true;
        abortController.abort(
          new DOMException("Critical asset download timed out.", "TimeoutError"),
        );
        setWorldLoadState({ status: "failed" });
      }
    }, worldDownloadTimeoutMs);

    const worldImportPromise = import("./world/WorldExperience");
    const startupAssetsPromise = preloadStartupAssets((progress) => {
      if (isCancelled) {
        return;
      }

      setStartupAssetProgress(progress);
      const downloadRatio =
        progress.bytesTotal > 0
          ? progress.bytesLoaded / progress.bytesTotal
          : progress.completed / Math.max(1, progress.total);
      setStartupProgress(
        startupInitialProgress +
          downloadRatio * (startupDownloadTarget - startupInitialProgress),
      );
    }, abortController.signal);

    void Promise.all([worldImportPromise, startupAssetsPromise])
      .then(([module]) => {
        if (!isCancelled && !hasSettled) {
          hasSettled = true;
          window.clearTimeout(downloadTimeoutId);
          setWorldLoadState({
            status: "loaded",
            Component: module.WorldExperience,
          });
        }
      })
      .catch(() => {
        if (!isCancelled && !hasSettled) {
          hasSettled = true;
          window.clearTimeout(downloadTimeoutId);
          setWorldLoadState({ status: "failed" });
        }
      });

    return () => {
      isCancelled = true;
      abortController.abort();
      window.clearTimeout(downloadTimeoutId);
    };
  }, [downloadAttempt, runtimeState]);

  useEffect(() => {
    if (
      runtimeState !== "checking" ||
      worldLoadState.status !== "loaded"
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRuntimeState((currentState) =>
        currentState === "checking" ? "error" : currentState,
      );
    }, worldStartupTimeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [runtimeState, worldLoadState.status]);

  useEffect(() => {
    if (runtimeState === "ready") {
      setStartupProgress(100);
      return undefined;
    }

    if (runtimeState !== "checking" || startupAssetProgress) {
      return undefined;
    }

    const targetProgress =
      worldLoadState.status === "loading"
        ? startupDownloadTarget
        : startupInitializeTarget;
    const intervalId = window.setInterval(() => {
      setStartupProgress((currentProgress) => {
        if (currentProgress >= targetProgress) {
          return currentProgress;
        }

        const progressStep =
          worldLoadState.status === "loading" &&
          currentProgress >= startupDownloadSoftTarget
            ? 0.08
            : Math.max(0.5, (targetProgress - currentProgress) * 0.08);
        const nextStep = Math.min(
          Math.max(0, targetProgress - currentProgress),
          progressStep,
        );
        return Math.min(targetProgress, currentProgress + nextStep);
      });
    }, 140);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [runtimeState, startupAssetProgress, worldLoadState.status]);

  const retryCriticalAssets = useCallback(() => {
    setStartupAssetProgress(null);
    setStartupProgress(startupInitialProgress);
    setWorldLoadState({ status: "loading" });
    setDownloadAttempt((attempt) => attempt + 1);
  }, []);

  if (runtimeState === "fallback" || runtimeState === "error") {
    return <FallbackPage reason={getFallbackReason(runtimeState)} />;
  }

  const WorldExperience =
    worldLoadState.status === "loaded" ? worldLoadState.Component : null;

  return (
    <>
      <WorldErrorBoundary
        onWorldError={() =>
          setRuntimeState((currentState) =>
            currentState === "checking" ? "error" : currentState,
          )
        }
      >
        {WorldExperience ? (
          <WorldExperience onReady={() => setRuntimeState("ready")} />
        ) : null}
      </WorldErrorBoundary>
      {runtimeState === "checking" ? (
        <StartupScreen
          assetProgress={startupAssetProgress}
          hasFailed={worldLoadState.status === "failed"}
          label={getStartupLabel(
            worldLoadState,
            startupAssetProgress,
            startupProgress,
          )}
          onRetry={retryCriticalAssets}
          progress={startupProgress}
        />
      ) : null}
    </>
  );
}
