import {
  getAuthSession,
  loginAuthSession,
  type AuthSessionSnapshot,
  type AuthUser,
} from "./authSession";

export const laboratoryAccessRoles = ["admin", "armbot", "door"] as const;

export type LaboratoryAccessRole = (typeof laboratoryAccessRoles)[number];
export type LaboratoryAuthUser = AuthUser;

export type LaboratoryAccessStatus =
  | "checking"
  | "error"
  | "forbidden"
  | "guest"
  | "loggingIn"
  | "ready";

export interface LaboratoryAccessSnapshot {
  message: string;
  status: LaboratoryAccessStatus;
  user: LaboratoryAuthUser | null;
}

export const initialLaboratoryAccessSnapshot: LaboratoryAccessSnapshot = {
  message: "正在检查实验室权限",
  status: "checking",
  user: null,
};

export function hasLaboratoryAccess(user: LaboratoryAuthUser | null): boolean {
  return Boolean(
    user && laboratoryAccessRoles.some((role) => user.roles.includes(role)),
  );
}

function toLaboratoryAccess(
  snapshot: AuthSessionSnapshot,
): LaboratoryAccessSnapshot {
  if (snapshot.status !== "ready" || !snapshot.user) {
    return {
      message: snapshot.status === "guest"
        ? "请先登录后进入天空实验室"
        : snapshot.message,
      status: snapshot.status,
      user: snapshot.user,
    };
  }

  if (!hasLaboratoryAccess(snapshot.user)) {
    return {
      message: "需要 admin/armbot/door 权限",
      status: "forbidden",
      user: snapshot.user,
    };
  }

  return {
    message: "实验室权限已通过",
    status: "ready",
    user: snapshot.user,
  };
}

export async function getLaboratoryAccess(): Promise<LaboratoryAccessSnapshot> {
  return toLaboratoryAccess(await getAuthSession());
}

export async function loginLaboratoryAccess(
  username: string,
  password: string,
): Promise<LaboratoryAccessSnapshot> {
  return toLaboratoryAccess(await loginAuthSession(username, password));
}
