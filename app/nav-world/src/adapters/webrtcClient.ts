export type LaboratoryWebRtcMode = "mock" | "off" | "whep";

export type LaboratoryWebRtcStatus =
  | "idle"
  | "connecting"
  | "online"
  | "offline"
  | "unauthorized"
  | "error";

export type LaboratoryStreamSource = "mock" | "none" | "webrtc";

export interface LaboratoryStreamSnapshot {
  message: string;
  source: LaboratoryStreamSource;
  status: LaboratoryWebRtcStatus;
  stream: MediaStream | null;
}

export interface LaboratoryWebRtcConfig {
  iceGatheringTimeoutMs: number;
  iceServers?: RTCIceServer[];
  mode: LaboratoryWebRtcMode;
  signalingUrl: string;
  streamId: string;
  timeoutMs: number;
}

export interface LaboratoryStreamHandle {
  disconnect: () => void;
}

type StreamUpdateListener = (snapshot: LaboratoryStreamSnapshot) => void;

const defaultTimeoutMs = 8000;
const defaultIceGatheringTimeoutMs = 1800;

interface WhepOfferData {
  icePwd: string;
  iceUfrag: string;
  medias: string[];
}

type WhepResponseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      snapshot: LaboratoryStreamSnapshot;
    };

function getEnvString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getEnvNumber(value: unknown, fallback: number): number {
  const text = getEnvString(value);
  const parsed = Number(text);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeMode(value: string): LaboratoryWebRtcMode {
  if (value === "off" || value === "disabled") {
    return "off";
  }

  if (value === "whep" || value === "real") {
    return "whep";
  }

  return "mock";
}

function parseIceServers(rawValue: string): RTCIceServer[] | undefined {
  if (!rawValue) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const servers = parsed
    .map((entry): RTCIceServer | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as {
        credential?: unknown;
        urls?: unknown;
        username?: unknown;
      };
      const urls = candidate.urls;

      if (
        typeof urls !== "string" &&
        (!Array.isArray(urls) ||
          urls.some((url) => typeof url !== "string"))
      ) {
        return null;
      }

      const server: RTCIceServer = { urls };

      if (typeof candidate.username === "string") {
        server.username = candidate.username;
      }

      if (typeof candidate.credential === "string") {
        server.credential = candidate.credential;
      }

      return server;
    })
    .filter((server): server is RTCIceServer => Boolean(server));

  return servers.length > 0 ? servers : undefined;
}

export function getLaboratoryWebRtcConfig(): LaboratoryWebRtcConfig {
  return {
    iceGatheringTimeoutMs: getEnvNumber(
      import.meta.env.VITE_LAB_WEBRTC_ICE_GATHERING_TIMEOUT_MS,
      defaultIceGatheringTimeoutMs,
    ),
    iceServers: parseIceServers(
      getEnvString(import.meta.env.VITE_LAB_WEBRTC_ICE_SERVERS),
    ),
    mode: normalizeMode(getEnvString(import.meta.env.VITE_LAB_WEBRTC_MODE)),
    signalingUrl: getEnvString(
      import.meta.env.VITE_LAB_WEBRTC_SIGNALING_URL,
    ),
    streamId: getEnvString(import.meta.env.VITE_LAB_WEBRTC_STREAM_ID),
    timeoutMs: getEnvNumber(
      import.meta.env.VITE_LAB_WEBRTC_TIMEOUT_MS,
      defaultTimeoutMs,
    ),
  };
}

function createSnapshot(
  status: LaboratoryWebRtcStatus,
  message: string,
  stream: MediaStream | null = null,
  source: LaboratoryStreamSource = "none",
): LaboratoryStreamSnapshot {
  return {
    message,
    source,
    status,
    stream,
  };
}

function drawMockFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  timestamp: number,
) {
  const seconds = timestamp / 1000;
  const sweep = (Math.sin(seconds * 0.95) + 1) / 2;
  const pulse = (Math.sin(seconds * 2.2) + 1) / 2;
  const gradient = context.createLinearGradient(0, 0, width, height);

  gradient.addColorStop(0, "#e9f8ff");
  gradient.addColorStop(0.52, "#9fd9eb");
  gradient.addColorStop(1, "#f7fbfd");

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(36, 113, 143, 0.18)";
  context.lineWidth = 2;

  for (let x = 0; x <= width; x += 80) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += 80) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.fillStyle = "rgba(255, 255, 255, 0.64)";
  context.fillRect(64, 70, width - 128, height - 140);

  context.strokeStyle = "#4db6d5";
  context.lineWidth = 8;
  context.strokeRect(72, 78, width - 144, height - 156);

  context.strokeStyle = "rgba(36, 113, 143, 0.72)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(120, height * (0.68 - pulse * 0.12));

  for (let i = 0; i <= 24; i += 1) {
    const x = 120 + ((width - 240) / 24) * i;
    const y =
      height * 0.58 +
      Math.sin(seconds * 2.8 + i * 0.62) * 54 +
      Math.cos(seconds * 0.9 + i * 0.34) * 26;
    context.lineTo(x, y);
  }

  context.stroke();

  context.strokeStyle = "#1a6c88";
  context.lineWidth = 10;
  context.beginPath();
  context.arc(width * 0.5, height * 0.52, 96 + pulse * 28, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = "#78e3ff";
  context.lineWidth = 16;
  context.beginPath();
  context.arc(
    width * 0.5,
    height * 0.52,
    158,
    -Math.PI * 0.5,
    -Math.PI * 0.5 + Math.PI * 2 * sweep,
  );
  context.stroke();

  context.fillStyle = "#15536b";
  context.font = "700 54px sans-serif";
  context.textAlign = "center";
  context.fillText("天空实验室测试流", width / 2, 142);

  context.font = "500 30px sans-serif";
  context.fillText("等待接入真实 WebRTC", width / 2, height - 112);

  context.fillStyle = "#2d7c98";
  context.font = "600 28px monospace";
  context.textAlign = "right";
  context.fillText(
    `T+${seconds.toFixed(1)}s`,
    width - 102,
    height - 52,
  );
}

function connectMockStream(
  onUpdate: StreamUpdateListener,
): LaboratoryStreamHandle {
  const canvas = document.createElement("canvas");
  const width = 1280;
  const height = 720;
  const context = canvas.getContext("2d");
  let animationFrameId = 0;

  canvas.width = width;
  canvas.height = height;

  if (!context || typeof canvas.captureStream !== "function") {
    onUpdate(createSnapshot("offline", "浏览器不支持模拟视频流"));
    return { disconnect: () => undefined };
  }

  const draw = (timestamp: number) => {
    drawMockFrame(context, width, height, timestamp);
    animationFrameId = window.requestAnimationFrame(draw);
  };

  draw(performance.now());

  const stream = canvas.captureStream(24);

  if (stream.getVideoTracks().length === 0) {
    onUpdate(createSnapshot("offline", "模拟视频流不可用"));
    return {
      disconnect: () => {
        window.cancelAnimationFrame(animationFrameId);
      },
    };
  }

  onUpdate(
    createSnapshot("online", "模拟测试流", stream, "mock"),
  );

  return {
    disconnect: () => {
      window.cancelAnimationFrame(animationFrameId);
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    },
  };
}

function getWhepEndpoint(config: LaboratoryWebRtcConfig): string {
  const rawUrl = config.signalingUrl.replaceAll(
    "{streamId}",
    encodeURIComponent(config.streamId),
  );
  const endpoint = new URL(rawUrl, window.location.href);

  if (
    config.streamId &&
    !rawUrl.includes(config.streamId) &&
    !endpoint.searchParams.has("stream")
  ) {
    endpoint.searchParams.set("stream", config.streamId);
  }

  return endpoint.toString();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function splitLinkHeader(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let isQuoted = false;

  for (const character of value) {
    if (character === "\"") {
      isQuoted = !isQuoted;
    }

    if (character === "," && !isQuoted) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function unquoteLinkValue(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function parseIceServersFromLinkHeader(header: string | null): RTCIceServer[] {
  if (!header) {
    return [];
  }

  return splitLinkHeader(header)
    .map((link): RTCIceServer | null => {
      const match = link.match(
        /^<(.+?)>;\s*rel="ice-server"(?:;\s*username="(.*?)";\s*credential="(.*?)";\s*credential-type="password")?/i,
      );

      if (!match) {
        return null;
      }

      const server: RTCIceServer = {
        urls: [match[1]],
      };

      if (match[2] !== undefined && match[3] !== undefined) {
        server.username = unquoteLinkValue(match[2]);
        server.credential = unquoteLinkValue(match[3]);
      }

      return server;
    })
    .filter((server): server is RTCIceServer => Boolean(server));
}

function parseWhepOfferData(sdp: string): WhepOfferData {
  const offerData: WhepOfferData = {
    icePwd: "",
    iceUfrag: "",
    medias: [],
  };

  for (const line of sdp.split("\r\n")) {
    if (line.startsWith("m=")) {
      offerData.medias.push(line.slice("m=".length));
    } else if (!offerData.iceUfrag && line.startsWith("a=ice-ufrag:")) {
      offerData.iceUfrag = line.slice("a=ice-ufrag:".length);
    } else if (!offerData.icePwd && line.startsWith("a=ice-pwd:")) {
      offerData.icePwd = line.slice("a=ice-pwd:".length);
    }
  }

  return offerData;
}

function generateWhepSdpFragment(
  offerData: WhepOfferData,
  candidates: RTCIceCandidate[],
): string {
  const candidatesByMedia = new Map<number, RTCIceCandidate[]>();

  for (const candidate of candidates) {
    if (
      typeof candidate.sdpMLineIndex !== "number" ||
      !candidate.candidate.trim()
    ) {
      continue;
    }

    const mediaCandidates =
      candidatesByMedia.get(candidate.sdpMLineIndex) ?? [];

    mediaCandidates.push(candidate);
    candidatesByMedia.set(candidate.sdpMLineIndex, mediaCandidates);
  }

  if (candidatesByMedia.size === 0) {
    return "";
  }

  let fragment =
    `a=ice-ufrag:${offerData.iceUfrag}\r\n` +
    `a=ice-pwd:${offerData.icePwd}\r\n`;

  offerData.medias.forEach((media, mediaIndex) => {
    const mediaCandidates = candidatesByMedia.get(mediaIndex);

    if (!mediaCandidates?.length) {
      return;
    }

    fragment += `m=${media}\r\n` + `a=mid:${mediaIndex}\r\n`;

    for (const candidate of mediaCandidates) {
      fragment += `a=${candidate.candidate}\r\n`;
    }
  });

  return fragment.includes("m=") ? fragment : "";
}

async function createFailureSnapshot(
  response: Response,
  fallbackMessage: string,
): Promise<LaboratoryStreamSnapshot> {
  if (response.status === 401 || response.status === 403) {
    return createSnapshot("unauthorized", "没有查看权限");
  }

  if (
    response.status === 404 ||
    response.status === 410 ||
    response.status === 503
  ) {
    return createSnapshot("offline", "视频流离线");
  }

  let responseText = "";

  try {
    responseText = await response.text();
  } catch {
    responseText = "";
  }

  if (responseText.includes("no stream is available")) {
    return createSnapshot("offline", "视频流离线");
  }

  return createSnapshot("error", fallbackMessage);
}

async function requestWhepIceServers(
  endpoint: string,
  config: LaboratoryWebRtcConfig,
  signal: AbortSignal,
): Promise<WhepResponseResult<RTCIceServer[] | undefined>> {
  const response = await fetch(endpoint, {
    cache: "no-store",
    credentials: "include",
    method: "OPTIONS",
    signal,
  });

  if (response.status === 405) {
    return {
      ok: true,
      value: config.iceServers,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      snapshot: await createFailureSnapshot(response, "WebRTC ICE 配置失败"),
    };
  }

  const linkIceServers = parseIceServersFromLinkHeader(
    response.headers.get("Link"),
  );

  return {
    ok: true,
    value:
      linkIceServers.length > 0
        ? linkIceServers
        : config.iceServers,
  };
}

function resolveWhepSessionUrl(
  locationHeader: string,
  endpoint: string,
  streamId: string,
): string {
  const endpointUrl = new URL(endpoint);
  const sessionUrl = new URL(locationHeader, endpointUrl);

  if (sessionUrl.origin === endpointUrl.origin || !streamId) {
    return sessionUrl.toString();
  }

  const streamPathMarker = `/${encodeURIComponent(streamId)}/`;
  const endpointMarkerIndex = endpointUrl.pathname.indexOf(streamPathMarker);

  if (
    endpointMarkerIndex >= 0 &&
    sessionUrl.pathname.startsWith(streamPathMarker)
  ) {
    const publicPrefix = endpointUrl.pathname.slice(0, endpointMarkerIndex);
    const publicSessionUrl = new URL(
      `${publicPrefix}${sessionUrl.pathname}${sessionUrl.search}${sessionUrl.hash}`,
      endpointUrl.origin,
    );

    return publicSessionUrl.toString();
  }

  return sessionUrl.toString();
}

function connectWhepStream(
  config: LaboratoryWebRtcConfig,
  onUpdate: StreamUpdateListener,
): LaboratoryStreamHandle {
  if (!config.signalingUrl) {
    onUpdate(createSnapshot("offline", "缺少 WebRTC 信令地址"));
    return { disconnect: () => undefined };
  }

  const controller = new AbortController();
  const endpoint = getWhepEndpoint(config);
  const remoteStream = new MediaStream();
  let peerConnection: RTCPeerConnection | null = null;
  let isDisconnected = false;
  let hasVideoTrack = false;
  let hasCleanedUp = false;
  let offerData: WhepOfferData | null = null;
  let sessionUrl: string | null = null;
  let queuedCandidates: RTCIceCandidate[] = [];

  const streamTimeoutId = window.setTimeout(() => {
    if (isDisconnected || hasVideoTrack) {
      return;
    }

    onUpdate(createSnapshot("offline", "等待视频轨道超时"));
  }, config.timeoutMs);

  const closePeerAfterSessionDelete = (
    connection: RTCPeerConnection,
    url: string,
  ) => {
    let isClosed = false;

    const closeConnection = () => {
      if (isClosed) {
        return;
      }

      isClosed = true;
      connection.close();
    };
    const closeFallbackId = window.setTimeout(closeConnection, 1200);

    void fetch(url, {
      cache: "no-store",
      credentials: "include",
      method: "DELETE",
    }).catch(() => undefined).finally(() => {
      window.clearTimeout(closeFallbackId);
      closeConnection();
    });
  };

  const cleanupPeer = () => {
    if (hasCleanedUp) {
      return;
    }

    hasCleanedUp = true;
    window.clearTimeout(streamTimeoutId);
    remoteStream.getTracks().forEach((track) => {
      track.stop();
    });

    const connection = peerConnection;
    const url = sessionUrl;

    peerConnection = null;
    sessionUrl = null;

    if (!connection) {
      return;
    }

    if (
      url &&
      (connection.connectionState === "connected" ||
        connection.connectionState === "connecting")
    ) {
      closePeerAfterSessionDelete(connection, url);
      return;
    }

    connection.close();
  };

  const handleTrackEnded = (track: MediaStreamTrack) => {
    remoteStream.removeTrack(track);

    if (remoteStream.getVideoTracks().length === 0) {
      hasVideoTrack = false;
      onUpdate(createSnapshot("offline", "视频流已断开"));
    }
  };

  const sendLocalCandidates = (candidates: RTCIceCandidate[]) => {
    if (!sessionUrl || !offerData || isDisconnected) {
      return;
    }

    const fragment = generateWhepSdpFragment(offerData, candidates);

    if (!fragment) {
      return;
    }

    void fetch(sessionUrl, {
      body: fragment,
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/trickle-ice-sdpfrag",
        "If-Match": "*",
      },
      method: "PATCH",
    }).then(async (response) => {
      if (response.status === 204 || isDisconnected) {
        return;
      }

      onUpdate(
        await createFailureSnapshot(response, "WebRTC ICE candidate 发送失败"),
      );
    }).catch(() => {
      if (!isDisconnected) {
        onUpdate(createSnapshot("error", "WebRTC ICE candidate 发送异常"));
      }
    });
  };

  const flushQueuedCandidates = () => {
    if (queuedCandidates.length === 0) {
      return;
    }

    sendLocalCandidates(queuedCandidates);
    queuedCandidates = [];
  };

  const handleLocalCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (isDisconnected || !event.candidate) {
      return;
    }

    if (!sessionUrl) {
      queuedCandidates.push(event.candidate);
      return;
    }

    sendLocalCandidates([event.candidate]);
  };

  const handleTrack = (event: RTCTrackEvent) => {
    if (isDisconnected) {
      return;
    }

    const track = event.track;

    if (!remoteStream.getTracks().some((streamTrack) => streamTrack.id === track.id)) {
      remoteStream.addTrack(track);
    }

    track.addEventListener("ended", () => {
      handleTrackEnded(track);
    });

    if (track.kind === "video") {
      hasVideoTrack = true;
      window.clearTimeout(streamTimeoutId);
      onUpdate(
        createSnapshot("online", "实时视频流", remoteStream, "webrtc"),
      );
    }
  };

  const handleConnectionStateChange = () => {
    if (!peerConnection) {
      return;
    }

    if (isDisconnected) {
      return;
    }

    if (peerConnection.connectionState === "failed") {
      onUpdate(createSnapshot("error", "WebRTC 连接失败"));
      cleanupPeer();
      return;
    }

    if (
      peerConnection.connectionState === "disconnected" ||
      peerConnection.connectionState === "closed"
    ) {
      onUpdate(createSnapshot("offline", "WebRTC 连接已断开"));
      cleanupPeer();
    }
  };

  void (async () => {
    try {
      const iceServersResult = await requestWhepIceServers(
        endpoint,
        config,
        controller.signal,
      );

      if (!iceServersResult.ok) {
        onUpdate(iceServersResult.snapshot);
        cleanupPeer();
        return;
      }

      peerConnection = new RTCPeerConnection({
        iceServers: iceServersResult.value,
      });

      peerConnection.addEventListener("track", handleTrack);
      peerConnection.addEventListener(
        "connectionstatechange",
        handleConnectionStateChange,
      );
      peerConnection.addEventListener("icecandidate", handleLocalCandidate);

      peerConnection.addTransceiver("video", { direction: "recvonly" });
      peerConnection.addTransceiver("audio", { direction: "recvonly" });

      const offer = await peerConnection.createOffer();

      if (!offer.sdp) {
        onUpdate(createSnapshot("error", "WebRTC offer 创建失败"));
        cleanupPeer();
        return;
      }

      offerData = parseWhepOfferData(offer.sdp);

      await peerConnection.setLocalDescription(offer);

      if (!peerConnection.localDescription) {
        onUpdate(createSnapshot("error", "WebRTC offer 创建失败"));
        cleanupPeer();
        return;
      }

      const response = await fetch(endpoint, {
        body: peerConnection.localDescription.sdp,
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/sdp",
          "Content-Type": "application/sdp",
        },
        method: "POST",
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        onUpdate(await createFailureSnapshot(response, "WebRTC 信令失败"));
        cleanupPeer();
        return;
      }

      if (
        response.status === 404 ||
        response.status === 410 ||
        response.status === 503
      ) {
        onUpdate(await createFailureSnapshot(response, "WebRTC 信令失败"));
        cleanupPeer();
        return;
      }

      if (!response.ok && response.status !== 201) {
        onUpdate(await createFailureSnapshot(response, "WebRTC 信令失败"));
        cleanupPeer();
        return;
      }

      const locationHeader = response.headers.get("Location");

      if (!locationHeader) {
        onUpdate(createSnapshot("error", "WebRTC session 缺少地址"));
        cleanupPeer();
        return;
      }

      sessionUrl = resolveWhepSessionUrl(
        locationHeader,
        endpoint,
        config.streamId,
      );

      const answerSdp = await response.text();

      if (!answerSdp.trim()) {
        onUpdate(createSnapshot("error", "WebRTC answer 为空"));
        cleanupPeer();
        return;
      }

      await peerConnection.setRemoteDescription({
        sdp: answerSdp,
        type: "answer",
      });
      flushQueuedCandidates();
    } catch (error) {
      if (isDisconnected || isAbortError(error)) {
        return;
      }

      onUpdate(createSnapshot("error", "WebRTC 连接异常"));
      cleanupPeer();
    }
  })();

  return {
    disconnect: () => {
      if (isDisconnected) {
        return;
      }

      isDisconnected = true;
      cleanupPeer();
      controller.abort();
    },
  };
}

export function connectLaboratoryStream(
  config: LaboratoryWebRtcConfig,
  onUpdate: StreamUpdateListener,
): LaboratoryStreamHandle {
  onUpdate(createSnapshot("connecting", "正在连接外部世界"));

  if (config.mode === "off") {
    onUpdate(createSnapshot("offline", "视频流离线"));
    return { disconnect: () => undefined };
  }

  if (config.mode === "mock") {
    return connectMockStream(onUpdate);
  }

  return connectWhepStream(config, onUpdate);
}

export function disconnectLaboratoryStream(
  handle: LaboratoryStreamHandle | null,
) {
  handle?.disconnect();
}
