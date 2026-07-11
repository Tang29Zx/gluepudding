import { Html, Text } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import { DoubleSide } from "three";
import {
  connectLaboratoryStream,
  disconnectLaboratoryStream,
  getLaboratoryWebRtcConfig,
  type LaboratoryStreamSnapshot,
  type LaboratoryWebRtcStatus,
} from "../../adapters/webrtcClient";
import type { Vector3Tuple } from "../../world/sceneConfig";

interface LaboratoryWebRtcScreenProps {
  authorizationKey: string;
  height: number;
  isActive: boolean;
  isAuthorized: boolean;
  position: Vector3Tuple;
  width: number;
}

const initialSnapshot: LaboratoryStreamSnapshot = {
  message: "视频纹理待启动",
  source: "none",
  status: "idle",
  stream: null,
};
const whepRetryBaseDelayMs = 3000;
const whepRetryMaxDelayMs = 15000;
const nativeVideoWidthPx = 720;

const statusColors = {
  connecting: "#2d8eaa",
  error: "#bd426f",
  idle: "#6d7f87",
  offline: "#74838a",
  online: "#1f8d72",
  unauthorized: "#b47a28",
} satisfies Record<LaboratoryWebRtcStatus, string>;

function getStatusLabel(snapshot: LaboratoryStreamSnapshot): string {
  if (snapshot.status === "online" && snapshot.source === "mock") {
    return "模拟测试流";
  }

  if (snapshot.status === "online") {
    return "实时视频流";
  }

  return snapshot.message;
}

function configureVideoElement(video: HTMLVideoElement) {
  video.autoplay = true;
  video.loop = false;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");
  video.style.position = "absolute";
  video.style.inset = "0";
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.background = "#0b2028";
  video.style.objectFit = "cover";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
}

function shouldRetryStream(configMode: string, snapshot: LaboratoryStreamSnapshot) {
  return (
    configMode === "whep" &&
    (snapshot.status === "offline" || snapshot.status === "error")
  );
}

export function LaboratoryWebRtcScreen({
  authorizationKey,
  height,
  isActive,
  isAuthorized,
  position,
  width,
}: LaboratoryWebRtcScreenProps) {
  const config = useMemo(() => getLaboratoryWebRtcConfig(), []);
  const [snapshot, setSnapshot] =
    useState<LaboratoryStreamSnapshot>(initialSnapshot);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoElement;

    if (!video) {
      return undefined;
    }

    configureVideoElement(video);

    if (!isActive) {
      video.pause();
      video.srcObject = null;
      video.style.opacity = "0";
      setSnapshot({
        message: "进入天空实验室后连接",
        source: "none",
        status: "idle",
        stream: null,
      });
      return undefined;
    }

    if (!isAuthorized) {
      video.pause();
      video.srcObject = null;
      video.style.opacity = "0";
      setSnapshot({
        message: "没有查看权限",
        source: "none",
        status: "unauthorized",
        stream: null,
      });
      return undefined;
    }

    let handle: ReturnType<typeof connectLaboratoryStream> | null = null;
    let isDisposed = false;
    let pendingOnlineSnapshot: LaboratoryStreamSnapshot | null = null;
    let retryAttempt = 0;
    let retryTimeoutId: number | null = null;
    let videoFrameCallbackId: number | null = null;
    let videoFramePollId: number | null = null;
    let videoFrameTimeoutId: number | null = null;

    const clearVideoFrameWatch = () => {
      if (
        videoFrameCallbackId !== null &&
        typeof video.cancelVideoFrameCallback === "function"
      ) {
        video.cancelVideoFrameCallback(videoFrameCallbackId);
      }

      videoFrameCallbackId = null;

      if (videoFramePollId !== null) {
        window.clearInterval(videoFramePollId);
        videoFramePollId = null;
      }

      if (videoFrameTimeoutId !== null) {
        window.clearTimeout(videoFrameTimeoutId);
        videoFrameTimeoutId = null;
      }
    };

    const ensureVideoFrame = () => {
      if (isDisposed || !video.srcObject) {
        return false;
      }

      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return false;
      }

      video.style.opacity = "1";

      if (pendingOnlineSnapshot) {
        retryAttempt = 0;
        setSnapshot(pendingOnlineSnapshot);
        pendingOnlineSnapshot = null;
        clearVideoFrameWatch();
      }

      return true;
    };

    const watchForFirstVideoFrame = () => {
      clearVideoFrameWatch();

      if (typeof video.requestVideoFrameCallback === "function") {
        videoFrameCallbackId = video.requestVideoFrameCallback(() => {
          videoFrameCallbackId = null;

          if (!ensureVideoFrame() && !isDisposed) {
            watchForFirstVideoFrame();
          }
        });
      }

      videoFramePollId = window.setInterval(() => {
        ensureVideoFrame();
      }, 250);

      videoFrameTimeoutId = window.setTimeout(() => {
        if (isDisposed || ensureVideoFrame()) {
          return;
        }

        pendingOnlineSnapshot = null;
        clearVideoFrameWatch();
        const timeoutSnapshot: LaboratoryStreamSnapshot = {
          message: "实时视频解码超时",
          source: "none",
          status: "offline",
          stream: null,
        };

        setSnapshot(timeoutSnapshot);
        scheduleRetry();
      }, config.timeoutMs);
    };

    video.addEventListener("loadedmetadata", ensureVideoFrame);
    video.addEventListener("loadeddata", ensureVideoFrame);
    video.addEventListener("canplay", ensureVideoFrame);
    video.addEventListener("playing", ensureVideoFrame);
    video.addEventListener("resize", ensureVideoFrame);

    const clearRetry = () => {
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
    };

    const disconnectCurrentStream = () => {
      if (!handle) {
        return;
      }

      disconnectLaboratoryStream(handle);
      handle = null;
    };

    const startStreamConnection = () => {
      if (isDisposed) {
        return;
      }

      clearRetry();
      disconnectCurrentStream();
      handle = connectLaboratoryStream(config, connectVideoStream);
    };

    const scheduleRetry = () => {
      if (isDisposed || retryTimeoutId !== null) {
        return;
      }

      retryAttempt += 1;
      retryTimeoutId = window.setTimeout(
        startStreamConnection,
        Math.min(whepRetryBaseDelayMs * retryAttempt, whepRetryMaxDelayMs),
      );
    };

    const connectVideoStream = (nextSnapshot: LaboratoryStreamSnapshot) => {
      if (isDisposed) {
        return;
      }

      if (nextSnapshot.status !== "online") {
        setSnapshot(nextSnapshot);
      }

      if (shouldRetryStream(config.mode, nextSnapshot)) {
        scheduleRetry();
      }

      if (!nextSnapshot.stream) {
        pendingOnlineSnapshot = null;
        clearVideoFrameWatch();
        video.pause();
        video.srcObject = null;
        video.style.opacity = "0";
        return;
      }

      pendingOnlineSnapshot = nextSnapshot;
      clearRetry();
      setSnapshot({
        message: "正在解码实时视频",
        source: "none",
        status: "connecting",
        stream: null,
      });

      if (video.srcObject !== nextSnapshot.stream) {
        clearVideoFrameWatch();
        video.style.opacity = "0";
        video.srcObject = nextSnapshot.stream;
      }

      watchForFirstVideoFrame();

      void video.play().then(() => {
        ensureVideoFrame();
      }).catch(() => {
        if (isDisposed) {
          return;
        }

        pendingOnlineSnapshot = null;
        clearVideoFrameWatch();
        video.pause();
        video.srcObject = null;
        video.style.opacity = "0";
        const blockedSnapshot: LaboratoryStreamSnapshot = {
          message: "浏览器阻止视频播放",
          source: "none",
          status: "error",
          stream: null,
        };

        setSnapshot(blockedSnapshot);

        if (shouldRetryStream(config.mode, blockedSnapshot)) {
          scheduleRetry();
        }
      });
    };

    startStreamConnection();

    return () => {
      isDisposed = true;
      clearRetry();
      clearVideoFrameWatch();
      disconnectCurrentStream();
      video.removeEventListener("loadedmetadata", ensureVideoFrame);
      video.removeEventListener("loadeddata", ensureVideoFrame);
      video.removeEventListener("canplay", ensureVideoFrame);
      video.removeEventListener("playing", ensureVideoFrame);
      video.removeEventListener("resize", ensureVideoFrame);
      video.pause();
      video.srcObject = null;
      video.style.opacity = "0";
    };
  }, [authorizationKey, config, isActive, isAuthorized, videoElement]);

  const statusLabel = getStatusLabel(snapshot);
  const statusColor = statusColors[snapshot.status];
  const shouldShowCenteredStatus = snapshot.status !== "online";
  const nativeVideoHeightPx = nativeVideoWidthPx * (height / width);
  const nativeVideoDistanceFactor = (width / nativeVideoWidthPx) * 400;

  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color="#dff4fb"
          opacity={0.92}
          side={DoubleSide}
          transparent
        />
      </mesh>

      <Html
        distanceFactor={nativeVideoDistanceFactor}
        pointerEvents="none"
        position={[0, 0, 0.03]}
        transform
        zIndexRange={[1, 0]}
      >
        <div
          aria-hidden="true"
          style={{
            height: `${nativeVideoHeightPx}px`,
            overflow: "hidden",
            pointerEvents: "none",
            position: "relative",
            width: `${nativeVideoWidthPx}px`,
          }}
        >
          <video ref={setVideoElement} />
          {snapshot.status === "online" ? (
            <div
              style={{
                alignItems: "center",
                background: "rgba(246, 251, 254, 0.88)",
                bottom: "12px",
                color: statusColor,
                display: "flex",
                fontFamily: "system-ui, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                height: "32px",
                justifyContent: "center",
                left: "14px",
                position: "absolute",
                width: "142px",
                zIndex: 1,
              }}
            >
              {statusLabel}
            </div>
          ) : null}
        </div>
      </Html>

      {shouldShowCenteredStatus ? (
        <>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[width * 0.74, 0.82]} />
            <meshBasicMaterial
              color="#f6fbfe"
              opacity={0.82}
              side={DoubleSide}
              transparent
            />
          </mesh>
          <Text
            anchorX="center"
            anchorY="middle"
            color={statusColor}
            fontSize={0.24}
            maxWidth={width * 0.66}
            position={[0, 0.08, 0.05]}
          >
            {statusLabel}
          </Text>
          <Text
            anchorX="center"
            anchorY="middle"
            color="#5f7d89"
            fontSize={0.14}
            maxWidth={width * 0.66}
            position={[0, -0.22, 0.05]}
          >
            没有真实流时保持世界可用
          </Text>
        </>
      ) : null}
    </group>
  );
}
