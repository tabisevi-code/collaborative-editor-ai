import { ApiError, type LoginResponse } from "../types/api";
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

export interface RegisteredAuthUser {
  identifier: string;
  displayName: string;
  password: string;
  createdAt: string;
}

export interface AuthAdapter {
  login(input: LoginInput): Promise<AuthSessionPayload>;
  register(input: RegisterInput): Promise<AuthSessionPayload>;
  refresh(session: Pick<AuthSessionPayload, "user" | "refreshToken">): Promise<AuthSessionPayload>;
}

const REGISTERED_USERS_STORAGE_KEY = "collaborative-editor-ai.registered-users";
const MOCK_REFRESH_PREFIX = "mock-refresh";

function hasWindowStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readRegisteredUsers(): RegisteredAuthUser[] {
  if (!hasWindowStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RegisteredAuthUser[]) : [];
  } catch (error) {
    console.warn("[auth-adapter] failed_to_read_registered_users", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function writeRegisteredUsers(users: RegisteredAuthUser[]) {
  if (!hasWindowStorage()) {
    return;
  }

  window.localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(users));
}

function findRegisteredUser(identifier: string): RegisteredAuthUser | null {
  return readRegisteredUsers().find((user) => user.identifier === identifier) ?? null;
}

function toExpiresAt(expiresInSeconds: number | undefined): string {
  const ttlSeconds = typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds)
    ? expiresInSeconds
    : 60 * 60;
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function toSessionPayload(loginResponse: LoginResponse, displayNameOverride?: string): AuthSessionPayload {
  return {
    user: {
      id: loginResponse.userId,
      displayName: displayNameOverride || loginResponse.displayName || loginResponse.userId,
    },
    accessToken: loginResponse.accessToken,
    refreshToken: `${MOCK_REFRESH_PREFIX}-${loginResponse.userId}`,
    expiresAt: toExpiresAt(loginResponse.expiresIn),
  };
}

function ensureIdentifier(identifier: string): string {
  const normalized = identifier.trim();
  if (!normalized) {
    throw new ApiError(400, "INVALID_INPUT", "Identifier is required.");
  }

  return normalized;
}

function ensurePassword(password: string) {
  if (!password.trim()) {
    throw new ApiError(400, "INVALID_INPUT", "Password is required.");
  }
}

/**
 * The course backend does not implement Assignment 2 auth yet, so the
 * frontend keeps its contract stable by layering mock registration and refresh
 * behavior on top of the existing legacy login endpoint.
 */
export function createMockFirstAuthAdapter(apiClient: ApiClient): AuthAdapter {
  async function loginWithLegacyBackend(identifier: string, displayNameOverride?: string) {
    console.info("[auth-adapter] login_with_legacy_backend", {
      identifier,
    });
    const response = await apiClient.login(identifier);
    return toSessionPayload(response, displayNameOverride);
  }

  return {
    async login({ identifier, password }) {
      const normalizedIdentifier = ensureIdentifier(identifier);
      ensurePassword(password);

      const registeredUser = findRegisteredUser(normalizedIdentifier);
      if (registeredUser && registeredUser.password !== password) {
        throw new ApiError(401, "AUTH_FAILED", "Incorrect password.");
      }

      return loginWithLegacyBackend(normalizedIdentifier, registeredUser?.displayName);
    },

    async register({ identifier, displayName, password }) {
      const normalizedIdentifier = ensureIdentifier(identifier);
      const normalizedDisplayName = displayName.trim();
      ensurePassword(password);

      if (!normalizedDisplayName) {
        throw new ApiError(400, "INVALID_INPUT", "Display name is required.");
      }

      const existingUser = findRegisteredUser(normalizedIdentifier);
      if (existingUser) {
        throw new ApiError(409, "CONFLICT", "An account with this identifier already exists.");
      }

      const nextUser: RegisteredAuthUser = {
        identifier: normalizedIdentifier,
        displayName: normalizedDisplayName,
        password,
        createdAt: new Date().toISOString(),
      };

      const nextUsers = [...readRegisteredUsers(), nextUser];
      writeRegisteredUsers(nextUsers);
      console.info("[auth-adapter] registered_mock_user", {
        identifier: normalizedIdentifier,
      });

      return loginWithLegacyBackend(normalizedIdentifier, normalizedDisplayName);
    },

    async refresh(session) {
      const identifier = ensureIdentifier(session.user.id);
      if (!session.refreshToken) {
        throw new ApiError(401, "AUTH_REQUIRED", "No refresh token is available for this session.");
      }

      console.info("[auth-adapter] refresh_session", {
        identifier,
      });

      const registeredUser = findRegisteredUser(identifier);
      return loginWithLegacyBackend(identifier, registeredUser?.displayName ?? session.user.displayName);
    },
  };
}
