import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import {
  preloadAssetGroup,
  type StartupAssetProgress,
} from "./startupAssetPreloader";
import type { WorldAssetManifestItem } from "./worldAssetManifest";

export interface ModelDownloadProgress {
  bytesLoaded: number;
  bytesPerSecond: number;
  bytesTotal: number;
  label: string;
  percent: number;
  phase: "downloading" | "error" | "parsing";
  priority: number;
}

export type ModelDownloadProgressHandler = (
  taskId: string,
  progress: ModelDownloadProgress | null,
) => void;

interface TrackedModelGateProps {
  assets: readonly WorldAssetManifestItem[];
  children: ReactNode;
  groupLabel: string;
  onProgressChange: ModelDownloadProgressHandler;
  onReady?: () => void;
  priority?: number;
  taskId: string;
}

const ignoreReady = () => {};

function calculatePercent(progress: StartupAssetProgress): number {
  if (progress.bytesTotal > 0) {
    return (progress.bytesLoaded / progress.bytesTotal) * 100;
  }

  return (progress.completed / Math.max(1, progress.total)) * 100;
}

function ModelReadyMarker({ onReady }: { onReady: () => void }) {
  useLayoutEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

export function TrackedModelGate({
  assets,
  children,
  groupLabel,
  onProgressChange,
  onReady = ignoreReady,
  priority = 10,
  taskId,
}: TrackedModelGateProps) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer = 0;

    const reportProgress = (progress: StartupAssetProgress) => {
      onProgressChange(taskId, {
        bytesLoaded: progress.bytesLoaded,
        bytesPerSecond: progress.bytesPerSecond,
        bytesTotal: progress.bytesTotal,
        label: `${groupLabel} · ${progress.currentLabel}`,
        percent: calculatePercent(progress),
        phase: "downloading",
        priority,
      });
    };

    void preloadAssetGroup(assets, reportProgress, controller.signal, {
      concurrency: Math.min(4, assets.length),
      priority: "high",
    })
      .then(() => {
        if (controller.signal.aborted) {
          return;
        }

        onProgressChange(taskId, {
          bytesLoaded: 0,
          bytesPerSecond: 0,
          bytesTotal: 0,
          label: `正在解析${groupLabel}`,
          percent: 100,
          phase: "parsing",
          priority,
        });
        setIsDownloaded(true);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        onProgressChange(taskId, {
          bytesLoaded: 0,
          bytesPerSecond: 0,
          bytesTotal: 0,
          label: `${groupLabel}下载失败，正在重试`,
          percent: 0,
          phase: "error",
          priority,
        });
        retryTimer = window.setTimeout(() => {
          setRetryKey((current) => current + 1);
        }, 3_000);
      });

    return () => {
      controller.abort();
      window.clearTimeout(retryTimer);
    };
  }, [assets, groupLabel, onProgressChange, priority, retryKey, taskId]);

  useEffect(() => {
    return () => {
      onProgressChange(taskId, null);
    };
  }, [onProgressChange, taskId]);

  const handleReady = useCallback(() => {
    onReady();
    onProgressChange(taskId, null);
  }, [onProgressChange, onReady, taskId]);

  if (!isDownloaded) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      {children}
      <ModelReadyMarker onReady={handleReady} />
    </Suspense>
  );
}
