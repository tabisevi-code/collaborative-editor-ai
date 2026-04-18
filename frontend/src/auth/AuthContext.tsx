import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "../types/api";
import type {
  AuthAdapter,
  AuthSessionPayload,
  LoginInput,
  RegisterInput,
} from "../services/authAdapter";

type AuthStatus = "anonymous" | "restoring" | "authenticated" | "refreshing";

interface AuthContextValue {
  session: AuthSessionPayload | null;
  authStatus: AuthStatus;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): void;
  handleExpiredSession(): void;
}

const SESSION_STORAGE_KEY = "collaborative-editor-ai.auth-session";
const REFRESH_THRESHOLD_MS = 60 * 1000;

const AuthContext = createContext<AuthContextValue | null>(null);

function hasWindowSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredSession(): AuthSessionPayload | null {
  if (!hasWindowSessionStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AuthSessionPayload;
  } catch (error) {
    console.warn("[auth-context] failed_to_read_session", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function writeStoredSession(session: AuthSessionPayload | null) {
  if (!hasWindowSessionStorage()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function isExpired(session: AuthSessionPayload): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

function shouldRefreshSoon(session: AuthSessionPayload): boolean {
  return new Date(session.expiresAt).getTime() - Date.now() <= REFRESH_THRESHOLD_MS;
}

export function AuthProvider({
  adapter,
  children,
}: {
  adapter: AuthAdapter;
  children: ReactNode;
}) {
  const [session, setSession] = useState<AuthSessionPayload | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("restoring");
  const adapterRef = useRef(adapter);

  adapterRef.current = adapter;

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedSession = readStoredSession();
      if (!storedSession) {
        setAuthStatus("anonymous");
        return;
      }

      if (isExpired(storedSession) || shouldRefreshSoon(storedSession)) {
        try {
          console.info("[auth-context] restoring_session_with_refresh", {
            userId: storedSession.user.id,
          });
          setAuthStatus("refreshing");
          const refreshedSession = await adapterRef.current.refresh(storedSession);
          if (cancelled) {
            return;
          }
          setSession(refreshedSession);
          setAuthStatus("authenticated");
          return;
        } catch (error) {
          console.warn("[auth-context] restore_refresh_failed", {
            message: error instanceof Error ? error.message : String(error),
          });
          writeStoredSession(null);
          if (!cancelled) {
            setSession(null);
            setAuthStatus("anonymous");
          }
          return;
        }
      }

      console.info("[auth-context] restored_session", {
        userId: storedSession.user.id,
      });
      setSession(storedSession);
      setAuthStatus("authenticated");
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeStoredSession(session);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authStatus,

      async login(input) {
        setAuthStatus("refreshing");
        try {
          const nextSession = await adapterRef.current.login(input);
          console.info("[auth-context] login_success", {
            userId: nextSession.user.id,
          });
          setSession(nextSession);
          setAuthStatus("authenticated");
        } catch (error) {
          setAuthStatus("anonymous");
          throw error;
        }
      },

      async register(input) {
        setAuthStatus("refreshing");
        try {
          const nextSession = await adapterRef.current.register(input);
          console.info("[auth-context] register_success", {
            userId: nextSession.user.id,
          });
          setSession(nextSession);
          setAuthStatus("authenticated");
        } catch (error) {
          setAuthStatus("anonymous");
          throw error;
        }
      },

      logout() {
        console.info("[auth-context] logout");
        setSession(null);
        setAuthStatus("anonymous");
      },

      handleExpiredSession() {
        console.warn("[auth-context] session_expired");
        setSession(null);
        setAuthStatus("anonymous");
      },
    }),
    [authStatus, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}

export function toAuthError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, "UNKNOWN_ERROR", "Unexpected authentication error.");
}
