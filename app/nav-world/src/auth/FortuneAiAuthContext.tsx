import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getAuthSession,
  initialAuthSessionSnapshot,
  loginAuthSession,
  type AuthSessionSnapshot,
  type AuthUser,
} from "../adapters/authSession";
import {
  FortuneApiError,
  type ApiResponse,
} from "../modules/divination/fortuneApi";

interface FortuneAiAuthContextValue {
  access: AuthSessionSnapshot;
  cancelLogin: () => void;
  isInputActive: boolean;
  isLoginVisible: boolean;
  requestAuthenticated: <T>(
    request: (isAdmin: boolean) => Promise<ApiResponse<T>>,
  ) => Promise<ApiResponse<T> | null>;
  setInputActive: (isActive: boolean) => void;
  submitCredentials: (
    username: string,
    password: string,
  ) => Promise<AuthSessionSnapshot>;
}

const FortuneAiAuthContext = createContext<FortuneAiAuthContextValue | null>(
  null,
);

export function FortuneAiAuthProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState(initialAuthSessionSnapshot);
  const [isInputActive, setInputActive] = useState(false);
  const [isLoginVisible, setLoginVisible] = useState(false);
  const accessRef = useRef(access);
  const waitersRef = useRef<Array<(user: AuthUser | null) => void>>([]);

  useEffect(() => {
    accessRef.current = access;
  }, [access]);

  const resolveWaiters = useCallback((user: AuthUser | null) => {
    const waiters = waitersRef.current.splice(0);
    for (const resolve of waiters) resolve(user);
  }, []);

  const openLogin = useCallback(() => {
    setLoginVisible(true);
    return new Promise<AuthUser | null>((resolve) => {
      waitersRef.current.push(resolve);
    });
  }, []);

  const requireUser = useCallback(async (): Promise<AuthUser | null> => {
    if (accessRef.current.status === "ready" && accessRef.current.user) {
      return accessRef.current.user;
    }

    const snapshot = await getAuthSession();
    setAccess(snapshot);
    if (snapshot.status === "ready" && snapshot.user) {
      return snapshot.user;
    }

    return openLogin();
  }, [openLogin]);

  const cancelLogin = useCallback(() => {
    setInputActive(false);
    setLoginVisible(false);
    resolveWaiters(null);
  }, [resolveWaiters]);

  const submitCredentials = useCallback(
    async (username: string, password: string) => {
      setAccess({ message: "正在登录", status: "loggingIn", user: null });
      const snapshot = await loginAuthSession(username, password);
      setAccess(snapshot);

      if (snapshot.status === "ready" && snapshot.user) {
        setInputActive(false);
        setLoginVisible(false);
        resolveWaiters(snapshot.user);
      }

      return snapshot;
    },
    [resolveWaiters],
  );

  const requestAuthenticated = useCallback(
    async <T,>(
      request: (isAdmin: boolean) => Promise<ApiResponse<T>>,
    ): Promise<ApiResponse<T> | null> => {
      let user = await requireUser();
      if (!user) return null;

      const execute = () => request(user?.roles.includes("admin") ?? false);

      try {
        return await execute();
      } catch (error) {
        if (!(error instanceof FortuneApiError) || error.statusCode !== 401) {
          throw error;
        }

        setAccess({ message: "登录已失效，请重新登录", status: "guest", user: null });
        user = await openLogin();
        if (!user) return null;
        return execute();
      }
    },
    [openLogin, requireUser],
  );

  useEffect(() => () => resolveWaiters(null), [resolveWaiters]);

  const value = useMemo<FortuneAiAuthContextValue>(() => ({
    access,
    cancelLogin,
    isInputActive,
    isLoginVisible,
    requestAuthenticated,
    setInputActive,
    submitCredentials,
  }), [
    access,
    cancelLogin,
    isInputActive,
    isLoginVisible,
    requestAuthenticated,
    submitCredentials,
  ]);

  return (
    <FortuneAiAuthContext.Provider value={value}>
      {children}
    </FortuneAiAuthContext.Provider>
  );
}

export function useFortuneAiAuth(): FortuneAiAuthContextValue {
  const context = useContext(FortuneAiAuthContext);
  if (!context) {
    throw new Error("useFortuneAiAuth must be used inside FortuneAiAuthProvider");
  }
  return context;
}
