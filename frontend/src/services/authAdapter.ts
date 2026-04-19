import { ApiError, type AuthResponse } from "../types/api";
import type { ApiClient } from "./api";

export interface AuthUser {
  id: string;
  displayName: string;
}

export interface AuthSessionPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export interface AuthAdapter {
  setSession(session: AuthSessionPayload | null): void;
  login(input: LoginInput): Promise<AuthSessionPayload>;
  register(input: RegisterInput): Promise<AuthSessionPayload>;
  refresh(session: Pick<AuthSessionPayload, "user" | "refreshToken">): Promise<AuthSessionPayload>;
  logout(session: AuthSessionPayload | null): Promise<void>;
}

const IDENTIFIER_REGEX = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

function toExpiresAt(expiresInSeconds: number | undefined): string {
  const ttlSeconds = typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds) ? expiresInSeconds : 60 * 20;
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function toSessionPayload(response: AuthResponse): AuthSessionPayload {
  return {
    user: {
      id: response.userId,
      displayName: response.displayName || response.userId,
    },
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: toExpiresAt(response.expiresIn),
  };
}

function ensureIdentifier(identifier: string): string {
  const normalized = identifier.trim();
  if (!normalized) {
    throw new ApiError(400, "INVALID_INPUT", "Identifier is required.");
  }
  if (!IDENTIFIER_REGEX.test(normalized)) {
    throw new ApiError(400, "INVALID_INPUT", "Identifier may only contain letters, numbers, dots, underscores, and hyphens.");
  }
  return normalized;
}

function ensurePassword(password: string) {
  if (!password.trim()) {
    throw new ApiError(400, "INVALID_INPUT", "Password is required.");
  }
}

export function createBackendAuthAdapter(apiClient: ApiClient): AuthAdapter {
  return {
    setSession(session) {
      apiClient.setSession(session ? { accessToken: session.accessToken } : null);
    },

    async login({ identifier, password }) {
      const normalizedIdentifier = ensureIdentifier(identifier);
      ensurePassword(password);
      const response = await apiClient.login({ identifier: normalizedIdentifier, password });
      const session = toSessionPayload(response);
      apiClient.setSession({ accessToken: session.accessToken });
      return session;
    },

    async register({ identifier, displayName, password }) {
      const normalizedIdentifier = ensureIdentifier(identifier);
      const normalizedDisplayName = displayName.trim();
      ensurePassword(password);
      if (!normalizedDisplayName) {
        throw new ApiError(400, "INVALID_INPUT", "Display name is required.");
      }
      const response = await apiClient.register({
        identifier: normalizedIdentifier,
        displayName: normalizedDisplayName,
        password,
      });
      const session = toSessionPayload(response);
      apiClient.setSession({ accessToken: session.accessToken });
      return session;
    },

    async refresh(session) {
      const identifier = ensureIdentifier(session.user.id);
      if (!session.refreshToken) {
        throw new ApiError(401, "AUTH_REQUIRED", "No refresh token is available for this session.");
      }
      const response = await apiClient.refresh(session.refreshToken);
      const nextSession = toSessionPayload(response);
      apiClient.setSession({ accessToken: nextSession.accessToken });
      return {
        ...nextSession,
        user: {
          id: identifier,
          displayName: nextSession.user.displayName || session.user.displayName,
        },
      };
    },

    async logout(session) {
      try {
        if (session?.refreshToken) {
          await apiClient.logout(session.refreshToken);
        }
      } finally {
        apiClient.setSession(null);
      }
    },
  };
}
