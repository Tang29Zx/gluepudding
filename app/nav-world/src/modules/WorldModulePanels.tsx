import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import {
  DoubleSide,
  Mesh,
  Raycaster,
  Vector2,
} from "three";
import {
  worldModuleDefinitionList,
  type WorldModuleDefinition,
} from "./moduleRegistry";
import { WorldModuleErrorBoundary } from "./WorldModuleErrorBoundary";
import type {
  AimedWorldModuleControl,
  WorldModuleControlId,
  WorldModuleId,
  WorldModuleStatus,
} from "./types";

interface WorldModulePanelsProps {
  aimedModuleControl: AimedWorldModuleControl | null;
  moduleStatuses: Record<WorldModuleId, WorldModuleStatus>;
  onAimedModuleControlChange: (
    control: AimedWorldModuleControl | null,
  ) => void;
  onModuleStatusChange: (
    moduleId: WorldModuleId,
    status: WorldModuleStatus,
  ) => void;
}

interface ModuleControlDefinition extends AimedWorldModuleControl {
  x: number;
}

const screenCenter = new Vector2(0, 0);
const moduleRaycaster = new Raycaster();
const statusOrder = ["ready", "loading", "offline", "error"] as const;
const statusLabels = {
  error: "Error",
  loading: "Loading",
  offline: "Offline",
  ready: "Ready",
} satisfies Record<WorldModuleStatus, string>;
const statusColors = {
  error: "#c34676",
  loading: "#b9913e",
  offline: "#6a7482",
  ready: "#5a9b82",
} satisfies Record<WorldModuleStatus, string>;
const compactStatusCopy = {
  error: "Module error is isolated.",
  loading: "Preview loading state.",
  offline: "Offline placeholder is active.",
  ready: "Shell ready. Logic comes later.",
} satisfies Record<WorldModuleStatus, string>;

function getModuleControlId(
  moduleId: WorldModuleId,
  status: WorldModuleStatus,
): WorldModuleControlId {
  return `${moduleId}:status:${status}`;
}

function isSameControl(
  firstControl: AimedWorldModuleControl | null,
  secondControl: AimedWorldModuleControl | null,
): boolean {
  return firstControl?.actionId === secondControl?.actionId;
}

function createControls(
  definition: WorldModuleDefinition,
): ModuleControlDefinition[] {
  const buttonGap = 0.12;
  const buttonWidth =
    (definition.panelSize[0] - 0.82 - buttonGap * (statusOrder.length - 1)) /
    statusOrder.length;
  const rowStartX =
    -definition.panelSize[0] / 2 + 0.41 + buttonWidth / 2;

  return statusOrder.map((status, index) => ({
    actionId: getModuleControlId(definition.id, status),
    label: statusLabels[status],
    moduleId: definition.id,
    moduleTitle: definition.title,
    status,
    x: rowStartX + index * (buttonWidth + buttonGap),
  }));
}

function ModuleText({
  children,
  color = "#253146",
  fontSize,
  maxWidth,
  x,
  y,
}: {
  children: string;
  color?: string;
  fontSize: number;
  maxWidth: number;
  x: number;
  y: number;
}) {
  return (
    <Text
      anchorX="left"
      anchorY="middle"
      color={color}
      fontSize={fontSize}
      maxWidth={maxWidth}
      overflowWrap="break-word"
      position={[x, y, 0.046]}
      textAlign="left"
    >
      {children}
    </Text>
  );
}

function ModuleButton({
  control,
  isActive,
  isAimed,
  registerControlMesh,
  width,
  y,
}: {
  control: ModuleControlDefinition;
  isActive: boolean;
  isAimed: boolean;
  registerControlMesh: (
    control: AimedWorldModuleControl,
    mesh: Mesh | null,
  ) => void;
  width: number;
  y: number;
}) {
  const baseColor = statusColors[control.status];
  const fillColor = isActive || isAimed ? baseColor : "#f8fbff";
  const textColor = isActive || isAimed ? "#ffffff" : baseColor;

  return (
    <group position={[control.x, y, 0.068]}>
      <mesh
        ref={(mesh) => registerControlMesh(control, mesh)}
        scale={[isAimed ? 1.04 : 1, isAimed ? 1.08 : 1, 1]}
      >
        <boxGeometry args={[width, 0.34, 0.035]} />
        <meshBasicMaterial color={fillColor} transparent opacity={0.96} />
      </mesh>
      <mesh position={[0, 0, 0.024]}>
        <boxGeometry args={[width + 0.035, 0.375, 0.012]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={isAimed ? 0.9 : 0.34}
        />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color={textColor}
        fontSize={0.105}
        maxWidth={width - 0.08}
        position={[0, 0.005, 0.06]}
      >
        {control.label}
      </Text>
    </group>
  );
}

function ModulePanelFallback({
  definition,
}: {
  definition: WorldModuleDefinition;
}) {
  const [width, height] = definition.panelSize;

  return (
    <group
      position={definition.panelPosition}
      rotation={definition.panelRotation}
    >
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color="#fff4f8"
          side={DoubleSide}
          transparent
          opacity={0.96}
        />
      </mesh>
      <ModuleText
        color="#c34676"
        fontSize={0.28}
        maxWidth={width - 0.7}
        x={-width / 2 + 0.3}
        y={height / 2 - 0.48}
      >
        {definition.title}
      </ModuleText>
      <ModuleText
        fontSize={0.15}
        maxWidth={width - 0.7}
        x={-width / 2 + 0.3}
        y={0.18}
      >
        Local module render failed. The world remains active.
      </ModuleText>
    </group>
  );
}

function ModulePanel({
  aimedModuleControl,
  definition,
  registerControlMesh,
  status,
}: {
  aimedModuleControl: AimedWorldModuleControl | null;
  definition: WorldModuleDefinition;
  registerControlMesh: (
    control: AimedWorldModuleControl,
    mesh: Mesh | null,
  ) => void;
  status: WorldModuleStatus;
}) {
  const [width, height] = definition.panelSize;
  const contentX = -width / 2 + 0.34;
  const contentWidth = width - 0.68;
  const controls = createControls(definition);
  const buttonWidth =
    (width - 0.82 - 0.12 * (statusOrder.length - 1)) / statusOrder.length;
  const titleY = height / 2 - 0.58;
  const eyebrowY = titleY + 0.31;
  const subtitleY = titleY - 0.25;
  const statusY = subtitleY - 0.27;
  const statusCopyY = statusY - 0.21;
  const controlsY = statusCopyY - 0.33;
  const hintY = controlsY - 0.34;
  const capabilitiesStartY = hintY - 0.2;

  return (
    <group
      position={definition.panelPosition}
      rotation={definition.panelRotation}
    >
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color="#fbfbff"
          side={DoubleSide}
          transparent
          opacity={0.94}
        />
      </mesh>
      <mesh position={[-width / 2 + 0.04, 0, 0.032]}>
        <boxGeometry args={[0.08, height, 0.025]} />
        <meshBasicMaterial color={definition.accentColor} />
      </mesh>
      <mesh position={[0, height / 2 - 0.58, 0.034]}>
        <boxGeometry args={[width - 0.52, 0.03, 0.018]} />
        <meshBasicMaterial color={definition.accentColor} transparent opacity={0.32} />
      </mesh>

      <ModuleText
        color={definition.accentColor}
        fontSize={0.135}
        maxWidth={contentWidth}
        x={contentX}
        y={eyebrowY}
      >
        Layer 4 Surface
      </ModuleText>
      <ModuleText
        color="#1e2738"
        fontSize={0.285}
        maxWidth={contentWidth}
        x={contentX}
        y={titleY}
      >
        {definition.title}
      </ModuleText>
      <ModuleText
        color="#556070"
        fontSize={0.112}
        maxWidth={contentWidth}
        x={contentX}
        y={subtitleY}
      >
        {definition.subtitle}
      </ModuleText>
      <ModuleText
        color={statusColors[status]}
        fontSize={0.15}
        maxWidth={contentWidth}
        x={contentX}
        y={statusY}
      >
        {`Status: ${statusLabels[status]}`}
      </ModuleText>
      <ModuleText
        color="#374151"
        fontSize={0.095}
        maxWidth={contentWidth}
        x={contentX}
        y={statusCopyY}
      >
        {compactStatusCopy[status]}
      </ModuleText>

      {controls.map((control) => (
        <ModuleButton
          control={control}
          isActive={control.status === status}
          isAimed={aimedModuleControl?.actionId === control.actionId}
          key={control.actionId}
          registerControlMesh={registerControlMesh}
          width={buttonWidth}
          y={controlsY}
        />
      ))}

      <ModuleText
        color="#6b7280"
        fontSize={0.086}
        maxWidth={contentWidth}
        x={contentX}
        y={hintY}
      >
        Aim chip, click or press E.
      </ModuleText>

      {definition.capabilities.map((capability, index) => (
        <ModuleText
          color="#3f4859"
          fontSize={0.096}
          key={capability}
          maxWidth={contentWidth}
          x={contentX}
          y={capabilitiesStartY - index * 0.15}
        >
          {`- ${capability}`}
        </ModuleText>
      ))}
    </group>
  );
}

export function WorldModulePanels({
  aimedModuleControl,
  moduleStatuses,
  onAimedModuleControlChange,
  onModuleStatusChange,
}: WorldModulePanelsProps) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const aimedControlRef = useRef<AimedWorldModuleControl | null>(null);
  const controlsByMeshRef = useRef(new Map<string, AimedWorldModuleControl>());
  const controlMeshesRef = useRef(new Map<WorldModuleControlId, Mesh>());

  const registerControlMesh = useCallback(
    (control: AimedWorldModuleControl, mesh: Mesh | null) => {
      if (!mesh) {
        const previousMesh = controlMeshesRef.current.get(control.actionId);

        if (previousMesh) {
          controlsByMeshRef.current.delete(previousMesh.uuid);
        }

        controlMeshesRef.current.delete(control.actionId);
        return;
      }

      controlMeshesRef.current.set(control.actionId, mesh);
      controlsByMeshRef.current.set(mesh.uuid, control);
    },
    [],
  );

  const setAimedControl = useCallback(
    (control: AimedWorldModuleControl | null) => {
      if (isSameControl(aimedControlRef.current, control)) {
        return;
      }

      aimedControlRef.current = control;
      onAimedModuleControlChange(control);
    },
    [onAimedModuleControlChange],
  );

  const activateControl = useCallback(
    (control: AimedWorldModuleControl | null) => {
      if (!control) {
        return false;
      }

      onModuleStatusChange(control.moduleId, control.status);
      return true;
    },
    [onModuleStatusChange],
  );

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (!activateControl(aimedControlRef.current)) {
        return;
      }

      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.code !== "KeyE" && event.key.toLowerCase() !== "e")) {
        return;
      }

      if (!activateControl(aimedControlRef.current)) {
        return;
      }

      event.preventDefault();
    };

    domElement.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      domElement.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activateControl, domElement]);

  useFrame(() => {
    moduleRaycaster.setFromCamera(screenCenter, camera);

    const intersections = moduleRaycaster.intersectObjects(
      [...controlMeshesRef.current.values()],
      false,
    );
    const aimedControl =
      intersections
        .map((intersection) =>
          controlsByMeshRef.current.get(intersection.object.uuid) ?? null,
        )
        .find((control): control is AimedWorldModuleControl =>
          Boolean(control),
        ) ?? null;

    setAimedControl(aimedControl);
  });

  return (
    <group>
      {worldModuleDefinitionList
        .filter((definition) => definition.id !== "divination")
        .map((definition) => (
          <WorldModuleErrorBoundary
            fallback={<ModulePanelFallback definition={definition} />}
            key={definition.id}
            onError={() => onModuleStatusChange(definition.id, "error")}
            resetKey={`${definition.id}:${moduleStatuses[definition.id]}`}
          >
            <ModulePanel
              aimedModuleControl={aimedModuleControl}
              definition={definition}
              registerControlMesh={registerControlMesh}
              status={moduleStatuses[definition.id]}
            />
          </WorldModuleErrorBoundary>
        ))}
    </group>
  );
}
