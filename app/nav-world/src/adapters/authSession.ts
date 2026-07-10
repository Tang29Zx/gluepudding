export type AuthSessionStatus =
  | "checking"
  | "error"
  | "guest"
  | "loggingIn"
  | "ready";

export interface AuthUser {
  displayName: string;
  id: string;
  roles: string[];
  username: string;
}

export interface AuthSessionSnapshot {
  message: string;
  status: AuthSessionStatus;
  user: AuthUser | null;
}

const authSessionUrl = "/api/auth/session";
const authLoginUrl = "/api/sessions";

export const initialAuthSessionSnapshot: AuthSessionSnapshot = {
  message: "正在检查登录状态",
  status: "checking",
  user: null,
};

function createSnapshot(
  status: AuthSessionStatus,
  message: string,
  user: AuthUser | null = null,
): AuthSessionSnapshot {
  return { message, status, user };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null;

  const username = normalizeString(value.username);
  const displayName = normalizeString(value.displayName) || username;
  const id = normalizeString(value.id) || username;
  const roles = Array.isArray(value.roles)
    ? value.roles
        .map((role) => normalizeString(role).trim().toLowerCase())
        .filter(Boolean)
    : [];

  if (!id) return null;

  return { displayName, id, roles, username };
}

function shouldUseLocalFallback(): boolean {
  if (
    import.meta.env.VITE_AUTH_LOCAL_FETCH === "true" ||
    import.meta.env.VITE_LAB_AUTH_LOCAL_FETCH === "true"
  ) {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
  );
}

async function readJson(response: Response): Promise<unknown> {
  return response.headers.get("content-type")?.includes("application/json")
    ? response.json() as Promise<unknown>
    : null;
}

function snapshotFromResponse(
  response: Response,
  data: unknown,
): AuthSessionSnapshot {
  if (response.status === 401 || response.status === 403) {
    return createSnapshot("guest", "请先登录");
  }

  if (!response.ok || !isRecord(data)) {
    return createSnapshot("error", "登录态检查失败，请稍后再试");
  }

  const user = normalizeUser(data.user);
  return user
    ? createSnapshot("ready", "登录成功", user)
    : createSnapshot("error", "登录态数据异常，请重新登录");
}

export async function getAuthSession(): Promise<AuthSessionSnapshot> {
  if (shouldUseLocalFallback()) {
    return createSnapshot("guest", "本地预览未连接登录服务");
  }

  try {
    const response = await fetch(authSessionUrl, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return snapshotFromResponse(response, await readJson(response));
  } catch {
    return createSnapshot("error", "无法连接登录服务，请稍后再试");
  }
}

export async function loginAuthSession(
  username: string,
  password: string,
): Promise<AuthSessionSnapshot> {
  if (shouldUseLocalFallback()) {
    return createSnapshot("error", "本地预览未连接登录服务");
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
    const data = await readJson(response);

    if (response.status === 401) {
      return createSnapshot("guest", "用户名或密码不正确");
    }

    return snapshotFromResponse(response, data);
  } catch {
    return createSnapshot("error", "无法连接登录服务，请稍后再试");
  }
}
