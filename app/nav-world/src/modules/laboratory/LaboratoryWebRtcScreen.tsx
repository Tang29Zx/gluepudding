import { Text } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DoubleSide,
  LinearFilter,
  SRGBColorSpace,
  VideoTexture,
} from "three";
import {
  connectLaboratoryStream,
  disconnectLaboratoryStream,
  getLaboratoryWebRtcConfig,
  type LaboratoryStreamSnapshot,
  type LaboratoryWebRtcStatus,
} from "../../adapters/webrtcClient";
import type { Vector3Tuple } from "../../world/sceneConfig";

interface LaboratoryWebRtcScreenProps {
  height: number;
  position: Vector3Tuple;
  width: number;
}

const initialSnapshot: LaboratoryStreamSnapshot = {
  message: "视频纹理待启动",
  source: "none",
  status: "idle",
  stream: null,
};

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
}

function createVideoTexture(video: HTMLVideoElement): VideoTexture {
  const texture = new VideoTexture(video);

  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;

  return texture;
}

export function LaboratoryWebRtcScreen({
  height,
  position,
  width,
}: LaboratoryWebRtcScreenProps) {
  const config = useMemo(() => getLaboratoryWebRtcConfig(), []);
  const textureRef = useRef<VideoTexture | null>(null);
  const [snapshot, setSnapshot] =
    useState<LaboratoryStreamSnapshot>(initialSnapshot);
  const [videoTexture, setVideoTexture] =
    useState<VideoTexture | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    let isDisposed = false;

    configureVideoElement(video);

    const disposeTexture = (shouldUpdateState: boolean) => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }

      if (shouldUpdateState) {
        setVideoTexture(null);
      }
    };

    const connectVideoStream = (nextSnapshot: LaboratoryStreamSnapshot) => {
      if (isDisposed) {
        return;
      }

      setSnapshot(nextSnapshot);

      if (!nextSnapshot.stream) {
        video.pause();
        video.srcObject = null;
        disposeTexture(true);
        return;
      }

      if (video.srcObject !== nextSnapshot.stream) {
        video.srcObject = nextSnapshot.stream;
      }

      void video.play().then(() => {
        if (isDisposed) {
          return;
        }

        if (!textureRef.current) {
          textureRef.current = createVideoTexture(video);
          setVideoTexture(textureRef.current);
        }
      }).catch(() => {
        if (isDisposed) {
          return;
        }

        video.pause();
        video.srcObject = null;
        disposeTexture(true);
        setSnapshot({
          message: "浏览器阻止视频播放",
          source: "none",
          status: "error",
          stream: null,
        });
      });
    };

    const handle = connectLaboratoryStream(config, connectVideoStream);

    return () => {
      isDisposed = true;
      disconnectLaboratoryStream(handle);
      video.pause();
      video.srcObject = null;
      disposeTexture(false);
    };
  }, [config]);

  const statusLabel = getStatusLabel(snapshot);
  const statusColor = statusColors[snapshot.status];
  const shouldShowCenteredStatus = snapshot.status !== "online";

  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[width, height]} />
        {videoTexture ? (
          <meshBasicMaterial
            map={videoTexture}
            side={DoubleSide}
            toneMapped={false}
          />
        ) : (
          <meshBasicMaterial
            color="#dff4fb"
            opacity={0.92}
            side={DoubleSide}
            transparent
          />
        )}
      </mesh>

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
      ) : (
        <group position={[-width / 2 + 0.84, -height / 2 + 0.28, 0.04]}>
          <mesh>
            <planeGeometry args={[1.42, 0.32]} />
            <meshBasicMaterial
              color="#f6fbfe"
              opacity={0.86}
              side={DoubleSide}
              transparent
            />
          </mesh>
          <Text
            anchorX="center"
            anchorY="middle"
            color={statusColor}
            fontSize={0.13}
            maxWidth={1.22}
            position={[0, 0, 0.028]}
          >
            {statusLabel}
          </Text>
        </group>
      )}
    </group>
  );
}
