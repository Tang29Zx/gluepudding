export const laboratoryAccessRoles = ["admin", "armbot", "door"] as const;

export type LaboratoryAccessRole = (typeof laboratoryAccessRoles)[number];

export type LaboratoryAccessStatus =
  | "checking"
  | "error"
  | "forbidden"
  | "guest"
  | "loggingIn"
  | "ready";

export interface LaboratoryAuthUser {
  displayName: string;
  id: string;
  roles: string[];
  username: string;
}

export interface LaboratoryAccessSnapshot {
  message: string;
  status: LaboratoryAccessStatus;
  user: LaboratoryAuthUser | null;
}

const authSessionUrl = "/api/auth/session";
const authLoginUrl = "/api/sessions";

export const initialLaboratoryAccessSnapshot: LaboratoryAccessSnapshot = {
  message: "正在检查实验室权限",
  status: "checking",
  user: null,
};

export function createLaboratoryDebugAccessSnapshot(
  isLoggedIn: boolean,
): LaboratoryAccessSnapshot {
  if (!isLoggedIn) {
    return createAccessSnapshot("guest", "测试后门：当前模拟未登录");
  }

  return createAccessSnapshot("ready", "测试后门：当前模拟已登录", {
    displayName: "Laboratory Debug",
    id: "laboratory_debug",
    roles: ["admin"],
    username: "laboratory-debug",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createAccessSnapshot(
  status: LaboratoryAccessStatus,
  message: string,
  user: LaboratoryAuthUser | null = null,
): LaboratoryAccessSnapshot {
  return {
    message,
    status,
    user,
  };
}

function shouldUseLocalAuthFallback(): boolean {
  if (import.meta.env.VITE_LAB_AUTH_LOCAL_FETCH === "true") {
    return false;
  }

  const hostname = window.location.hostname;

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((role) => normalizeString(role).trim().toLowerCase())
    .filter(Boolean);
}

function normalizeUser(value: unknown): LaboratoryAuthUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const username = normalizeString(value.username);
  const displayName = normalizeString(value.displayName) || username;
  const id = normalizeString(value.id) || username;
  const roles = normalizeRoles(value.roles);

  if (!username && !id) {
    return null;
  }

  return {
    displayName,
    id,
    roles,
    username,
  };
}

export function hasLaboratoryAccess(user: LaboratoryAuthUser | null): boolean {
  if (!user) {
    return false;
  }

  return laboratoryAccessRoles.some((role) => user.roles.includes(role));
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json() as Promise<unknown>;
}

function snapshotFromSessionResponse(
  response: Response,
  data: unknown,
): LaboratoryAccessSnapshot {
  if (response.status === 401) {
    return createAccessSnapshot("guest", "请先登录后进入天空实验室");
  }

  if (response.status === 403) {
    return createAccessSnapshot(
      "forbidden",
      "当前账号没有实验室权限",
    );
  }

  if (!response.ok || !isRecord(data)) {
    return createAccessSnapshot("error", "登录态检查失败，请稍后再试");
  }

  const user = normalizeUser(data.user);

  if (!user) {
    return createAccessSnapshot("error", "登录态数据异常，请重新登录");
  }

  if (!hasLaboratoryAccess(user)) {
    return createAccessSnapshot(
      "forbidden",
      "需要 admin/armbot/door 权限",
      user,
    );
  }

  return createAccessSnapshot("ready", "实验室权限已通过", user);
}

export async function getLaboratoryAccess(): Promise<LaboratoryAccessSnapshot> {
  if (shouldUseLocalAuthFallback()) {
    return createAccessSnapshot(
      "guest",
      "本地预览未连接登录服务，可使用测试屏切换实验室权限",
    );
  }

  try {
    const response = await fetch(authSessionUrl, {
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
    const data = await readJsonResponse(response);

    return snapshotFromSessionResponse(response, data);
  } catch {
    return createAccessSnapshot(
      "error",
      "无法连接登录服务，请稍后再试",
    );
  }
}

export async function loginLaboratoryAccess(
  username: string,
  password: string,
): Promise<LaboratoryAccessSnapshot> {
  if (shouldUseLocalAuthFallback()) {
    return createAccessSnapshot(
      "error",
      "本地预览未连接登录服务，请使用测试屏切换实验室权限",
    );
  }

  try {
    const response = await fetch(authLoginUrl, {
      body: JSON.stringify({
        password,
        redirect: window.location.href,
        username,
      }),
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (response.status === 401) {
      return createAccessSnapshot("guest", "用户名或密码不正确");
    }

    if (!response.ok) {
      return createAccessSnapshot("error", "登录失败，请稍后再试");
    }

    return getLaboratoryAccess();
  } catch {
    return createAccessSnapshot(
      "error",
      "无法连接登录服务，请稍后再试",
    );
  }
}
