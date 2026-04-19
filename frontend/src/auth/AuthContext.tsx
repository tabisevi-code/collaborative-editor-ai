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
  logout(): Promise<void>;
  handleExpiredSession(): void;
}

const SESSION_STORAGE_KEY = "collaborative-editor-ai.auth-session";
const REFRESH_THRESHOLD_MS = 60 * 1000;

const AuthContext = createContext<AuthContextValue | null>(null);

function hasWindowSessionStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function" &&
    typeof window.localStorage.setItem === "function" &&
    typeof window.localStorage.removeItem === "function"
  );
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
  } catch {
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
        adapterRef.current.setSession(null);
        setAuthStatus("anonymous");
        return;
      }

      if (isExpired(storedSession) || shouldRefreshSoon(storedSession)) {
        try {
          setAuthStatus("refreshing");
          const refreshedSession = await adapterRef.current.refresh(storedSession);
          if (cancelled) {
            return;
          }
          setSession(refreshedSession);
          setAuthStatus("authenticated");
          return;
        } catch {
          adapterRef.current.setSession(null);
          writeStoredSession(null);
          if (!cancelled) {
            setSession(null);
            setAuthStatus("anonymous");
          }
          return;
        }
      }

      adapterRef.current.setSession(storedSession);
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
    adapterRef.current.setSession(session);
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const refreshAt = new Date(session.expiresAt).getTime() - REFRESH_THRESHOLD_MS - Date.now();
    const timeoutMs = Math.max(refreshAt, 0);
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setAuthStatus("refreshing");
        const refreshedSession = await adapterRef.current.refresh(session);
        if (cancelled) {
          return;
        }
        setSession(refreshedSession);
        setAuthStatus("authenticated");
      } catch {
        if (!cancelled) {
          adapterRef.current.setSession(null);
          setSession(null);
          setAuthStatus("anonymous");
        }
      }
    }, timeoutMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authStatus,

      async login(input) {
        setAuthStatus("refreshing");
        try {
          const nextSession = await adapterRef.current.login(input);
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
          setSession(nextSession);
          setAuthStatus("authenticated");
        } catch (error) {
          setAuthStatus("anonymous");
          throw error;
        }
      },

      async logout() {
        const currentSession = session;
        try {
          await adapterRef.current.logout(currentSession);
        } finally {
          setSession(null);
          setAuthStatus("anonymous");
        }
      },

      handleExpiredSession() {
        adapterRef.current.setSession(null);
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
