import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DoubleSide,
  Mesh,
  Raycaster,
  Vector2,
} from "three";
import type {
  LaboratoryAccessSnapshot,
} from "../../adapters/laboratoryAuth";
import type { Vector3Tuple } from "../../world/sceneConfig";

export type LaboratoryLoginField = "password" | "username";
export type LaboratoryLoginControlId = LaboratoryLoginField | "submit";

export interface AimedLaboratoryLoginControl {
  id: LaboratoryLoginControlId;
  label: string;
}

interface LaboratoryLoginScreenProps {
  access: LaboratoryAccessSnapshot;
  isVisible: boolean;
  onAimedControlChange: (
    control: AimedLaboratoryLoginControl | null,
  ) => void;
  onInputActiveChange: (isActive: boolean) => void;
  onRequestClose: () => void;
  onSubmitCredentials: (
    username: string,
    password: string,
  ) => Promise<LaboratoryAccessSnapshot>;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
}

const controlLabels = {
  password: "密码",
  submit: "登录",
  username: "用户名",
} satisfies Record<LaboratoryLoginControlId, string>;

const screenCenter = new Vector2(0, 0);
const passwordMask = "•";
const usernameMaxLength = 40;
const passwordMaxLength = 80;

function getStatusColor(status: LaboratoryAccessSnapshot["status"]): string {
  if (status === "ready") {
    return "#1f8d72";
  }

  if (status === "forbidden" || status === "guest") {
    return "#a86e1e";
  }

  if (status === "error") {
    return "#b83965";
  }

  return "#417c92";
}

function getFieldDisplayValue(
  field: LaboratoryLoginField,
  value: string,
): string {
  if (!value) {
    return field === "username" ? "输入用户名" : "输入密码";
  }

  if (field === "password") {
    return passwordMask.repeat(Math.min(value.length, 24));
  }

  return value;
}

function isPrintableKey(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey;
}

function getNextValue(
  currentValue: string,
  key: string,
  maxLength: number,
): string {
  if (currentValue.length >= maxLength) {
    return currentValue;
  }

  return `${currentValue}${key}`;
}

function FieldRow({
  activeField,
  field,
  label,
  registerControl,
  value,
}: {
  activeField: LaboratoryLoginField | null;
  field: LaboratoryLoginField;
  label: string;
  registerControl: (id: LaboratoryLoginControlId) => (mesh: Mesh | null) => void;
  value: string;
}) {
  const isActive = activeField === field;

  return (
    <group>
      <Text
        anchorX="right"
        anchorY="middle"
        color="#275266"
        fontSize={0.18}
        maxWidth={0.84}
        position={[-1.28, 0.035, 0.065]}
      >
        {label}
      </Text>
      <mesh ref={registerControl(field)} position={[0.28, 0, 0.045]}>
        <planeGeometry args={[2.7, 0.44]} />
        <meshBasicMaterial
          color={isActive ? "#f8fdff" : "#eaf6fb"}
          opacity={0.96}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0.28, -0.16, 0.068]}>
        <boxGeometry args={[2.72, 0.026, 0.018]} />
        <meshBasicMaterial
          color={isActive ? "#39b6d9" : "#8bc8da"}
          opacity={isActive ? 0.95 : 0.56}
          transparent
        />
      </mesh>
      <Text
        anchorX="left"
        anchorY="middle"
        color={value ? "#17475b" : "#7c99a6"}
        fontSize={0.17}
        maxWidth={2.42}
        position={[-0.94, 0.05, 0.09]}
      >
        {getFieldDisplayValue(field, value)}
      </Text>
    </group>
  );
}

export function LaboratoryLoginScreen({
  access,
  isVisible,
  onAimedControlChange,
  onInputActiveChange,
  onRequestClose,
  onSubmitCredentials,
  position,
  rotation,
}: LaboratoryLoginScreenProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const aimedControlRef = useRef<LaboratoryLoginControlId | null>(null);
  const controlMeshesRef = useRef<
    Partial<Record<LaboratoryLoginControlId, Mesh>>
  >({});
  const isVisibleRef = useRef(isVisible);
  const raycasterRef = useRef(new Raycaster());
  const submitRequestIdRef = useRef(0);
  const [activeField, setActiveField] =
    useState<LaboratoryLoginField | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [username, setUsername] = useState("");

  const registerControl = useCallback(
    (id: LaboratoryLoginControlId) => (mesh: Mesh | null) => {
      if (mesh) {
        controlMeshesRef.current[id] = mesh;
      } else {
        delete controlMeshesRef.current[id];
      }
    },
    [],
  );

  const setAimedControl = useCallback(
    (id: LaboratoryLoginControlId | null) => {
      if (aimedControlRef.current === id) {
        return;
      }

      aimedControlRef.current = id;
      onAimedControlChange(
        id
          ? {
              id,
              label: controlLabels[id],
            }
          : null,
      );
    },
    [onAimedControlChange],
  );

  const closeInput = useCallback(() => {
    setActiveField(null);
    onInputActiveChange(false);
  }, [onInputActiveChange]);

  const submit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setStatusMessage("请输入用户名和密码");
      return;
    }

    closeInput();
    setStatusMessage("正在登录");
    setIsSubmitting(true);
    submitRequestIdRef.current += 1;
    const requestId = submitRequestIdRef.current;

    void onSubmitCredentials(trimmedUsername, password).then((snapshot) => {
      if (submitRequestIdRef.current !== requestId || !isVisibleRef.current) {
        return;
      }

      if (snapshot.status === "ready") {
        setPassword("");
        setStatusMessage("登录成功，请再次按 Space 上行");
        onRequestClose();
        return;
      }

      setPassword("");
      setStatusMessage(snapshot.message);
      setActiveField("password");
      onInputActiveChange(true);
    }).catch(() => {
      if (submitRequestIdRef.current !== requestId || !isVisibleRef.current) {
        return;
      }

      setPassword("");
      setStatusMessage("登录失败，请稍后再试");
      setActiveField("password");
      onInputActiveChange(true);
    }).finally(() => {
      if (submitRequestIdRef.current === requestId) {
        setIsSubmitting(false);
      }
    });
  }, [
    closeInput,
    isSubmitting,
    onInputActiveChange,
    onRequestClose,
    onSubmitCredentials,
    password,
    username,
  ]);

  useEffect(() => {
    isVisibleRef.current = isVisible;

    if (!isVisible) {
      submitRequestIdRef.current += 1;
      setAimedControl(null);
      closeInput();
      setIsSubmitting(false);
      setPassword("");
      setStatusMessage("");
    }
  }, [closeInput, isVisible, setAimedControl]);

  useEffect(() => {
    if (!activeField || !isVisible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.code === "Escape") {
        closeInput();
        return;
      }

      if (event.code === "Tab") {
        setActiveField((currentField) =>
          currentField === "username" ? "password" : "username",
        );
        return;
      }

      if (event.code === "Enter") {
        if (activeField === "username") {
          setActiveField("password");
        } else {
          submit();
        }
        return;
      }

      if (event.code === "Backspace") {
        if (activeField === "username") {
          setUsername((currentValue) => currentValue.slice(0, -1));
        } else {
          setPassword((currentValue) => currentValue.slice(0, -1));
        }
        return;
      }

      if (!isPrintableKey(event)) {
        return;
      }

      if (activeField === "username") {
        setUsername((currentValue) =>
          getNextValue(currentValue, event.key, usernameMaxLength),
        );
      } else {
        setPassword((currentValue) =>
          getNextValue(currentValue, event.key, passwordMaxLength),
        );
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [activeField, closeInput, isVisible, submit]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!isVisible || event.button !== 0) {
        return;
      }

      const aimedControl = aimedControlRef.current;

      if (!aimedControl) {
        if (activeField) {
          closeInput();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (aimedControl === "submit") {
        submit();
        return;
      }

      setActiveField(aimedControl);
      onInputActiveChange(true);
    };

    domElement.addEventListener("click", handleClick);

    return () => {
      domElement.removeEventListener("click", handleClick);
    };
  }, [
    activeField,
    closeInput,
    domElement,
    isVisible,
    onInputActiveChange,
    submit,
  ]);

  useFrame(() => {
    if (!isVisible) {
      setAimedControl(null);
      return;
    }

    raycasterRef.current.setFromCamera(screenCenter, camera);

    const controls = Object.entries(controlMeshesRef.current)
      .filter((entry): entry is [LaboratoryLoginControlId, Mesh] =>
        Boolean(entry[1]),
      );
    const intersections = raycasterRef.current.intersectObjects(
      controls.map(([, mesh]) => mesh),
      false,
    );
    const aimedEntry = intersections
      .map((intersection) =>
        controls.find(([, mesh]) => mesh === intersection.object) ?? null,
      )
      .find((entry): entry is [LaboratoryLoginControlId, Mesh] =>
        Boolean(entry),
      );

    setAimedControl(aimedEntry?.[0] ?? null);
  });

  if (!isVisible) {
    return null;
  }

  const visibleMessage =
    statusMessage ||
    (access.status === "checking" || access.status === "loggingIn"
      ? "正在检查登录状态"
      : access.message);
  const statusColor = getStatusColor(access.status);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow position={[0, 0, -0.065]}>
        <boxGeometry args={[4.4, 2.72, 0.14]} />
        <meshStandardMaterial
          color="#d9edf5"
          emissive="#d7f5ff"
          emissiveIntensity={0.18}
          metalness={0.18}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[4.08, 2.42]} />
        <meshBasicMaterial
          color="#f6fcff"
          opacity={0.97}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.96, 0.044]}>
        <planeGeometry args={[3.76, 0.42]} />
        <meshBasicMaterial
          color="#d7f0fb"
          opacity={0.98}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#1a5670"
        fontSize={0.23}
        maxWidth={3.4}
        position={[0, 0.96, 0.082]}
      >
        用户名密码登录
      </Text>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#5b7887"
        fontSize={0.13}
        maxWidth={3.5}
        position={[0, 0.65, 0.078]}
      >
        需要 admin/armbot/door 权限进入天空实验室
      </Text>

      <group position={[0, 0.28, 0]}>
        <FieldRow
          activeField={activeField}
          field="username"
          label="用户名"
          registerControl={registerControl}
          value={username}
        />
      </group>
      <group position={[0, -0.36, 0]}>
        <FieldRow
          activeField={activeField}
          field="password"
          label="密码"
          registerControl={registerControl}
          value={password}
        />
      </group>

      <mesh ref={registerControl("submit")} position={[0, -0.88, 0.05]}>
        <planeGeometry args={[1.3, 0.4]} />
        <meshBasicMaterial
          color={isSubmitting ? "#b7d4df" : "#54b6d3"}
          opacity={0.94}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#ffffff"
        fontSize={0.17}
        maxWidth={1.1}
        position={[0, -0.88, 0.088]}
      >
        {isSubmitting ? "登录中" : "登录"}
      </Text>

      <Text
        anchorX="center"
        anchorY="middle"
        color={statusColor}
        fontSize={0.13}
        maxWidth={3.46}
        position={[0, -1.14, 0.08]}
      >
        {visibleMessage}
      </Text>
    </group>
  );
}
