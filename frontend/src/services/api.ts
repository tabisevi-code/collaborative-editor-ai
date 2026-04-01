import {
  ApiError,
  type ApiErrorShape,
  type AiJobResponse,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type GetDocumentResponse,
  type ListVersionsResponse,
  type RevertToVersionResponse,
  type RewriteAiJobRequest,
  type SummarizeAiJobRequest,
  type TranslateAiJobRequest,
  type UpdateDocumentRequest,
  type UpdateDocumentResponse,
} from "../types/api";

type FetchLike = typeof fetch;

export interface ApiClient {
  createDocument(payload: CreateDocumentRequest, userId?: string): Promise<CreateDocumentResponse>;
  getDocument(documentId: string, userId?: string): Promise<GetDocumentResponse>;
  updateDocument(documentId: string, payload: UpdateDocumentRequest, userId?: string): Promise<UpdateDocumentResponse>;
  listVersions(documentId: string, userId?: string): Promise<ListVersionsResponse>;
  revertToVersion(
    documentId: string,
    payload: { requestId: string; targetVersionId: string },
    userId?: string
  ): Promise<RevertToVersionResponse>;
  requestRewriteJob(payload: RewriteAiJobRequest, userId?: string): Promise<AiJobResponse>;
  requestSummarizeJob(payload: SummarizeAiJobRequest, userId?: string): Promise<AiJobResponse>;
  requestTranslateJob(payload: TranslateAiJobRequest, userId?: string): Promise<AiJobResponse>;
  getAiJobStatus(jobId: string, userId?: string): Promise<AiJobResponse>;
}

interface LoginResponse {
  accessToken: string;
}

const accessTokenCache = new Map<string, string>();

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function parseJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(response.status, "INVALID_RESPONSE", "backend returned invalid JSON");
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const typedPayload = payload as ApiErrorShape | null;
  const code = typedPayload?.error?.code || "UNKNOWN_ERROR";
  const message = typedPayload?.error?.message || "request failed";
  const details = typedPayload?.error?.details;
  return new ApiError(status, code, message, details);
}

function toUnexpectedError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new ApiError(0, "NETWORK_ERROR", "backend unavailable");
  }

  return new ApiError(0, "UNKNOWN_ERROR", "unexpected frontend error");
}

export function createApiClient(baseUrl: string, fetchImpl: FetchLike = fetch): ApiClient {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);

  async function login(userId: string): Promise<string> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      throw new ApiError(401, "AUTH_REQUIRED", "user id is required");
    }

    const cachedToken = accessTokenCache.get(normalizedUserId);
    if (cachedToken) {
      return cachedToken;
    }

    const response = await fetchImpl(`${resolvedBaseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: normalizedUserId }),
    });

    const payload = await parseJson(response);
    if (!response.ok) {
      throw toApiError(response.status, payload);
    }

    const accessToken = (payload as LoginResponse).accessToken;
    accessTokenCache.set(normalizedUserId, accessToken);
    return accessToken;
  }

  async function request<T>(path: string, init: RequestInit, userId?: string): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    try {
      if (userId?.trim()) {
        const accessToken = await login(userId);
        headers.set("Authorization", `Bearer ${accessToken}`);
      }

      console.info("[frontend-api] request", {
        method: init.method || "GET",
        url: `${resolvedBaseUrl}${path}`,
        userId,
      });

      const response = await fetchImpl(`${resolvedBaseUrl}${path}`, {
        ...init,
        headers,
      });
      const payload = await parseJson(response);

      if (!response.ok) {
        throw toApiError(response.status, payload);
      }

      return payload as T;
    } catch (error) {
      const normalizedError = toUnexpectedError(error);
      console.warn("[frontend-api] request_failed", {
        code: normalizedError.code,
        status: normalizedError.status,
        message: normalizedError.message,
      });
      throw normalizedError;
    }
  }

  return {
    createDocument(payload, userId) {
      return request<CreateDocumentResponse>(
        "/documents",
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
    },

    getDocument(documentId, userId) {
      return request<GetDocumentResponse>(
        `/documents/${encodeURIComponent(documentId)}`,
        { method: "GET" },
        userId
      );
    },

    updateDocument(documentId, payload, userId) {
      return request<UpdateDocumentResponse>(
        `/documents/${encodeURIComponent(documentId)}/content`,
        { method: "PUT", body: JSON.stringify(payload) },
        userId
      );
    },

    listVersions(documentId, userId) {
      return request<ListVersionsResponse>(
        `/documents/${encodeURIComponent(documentId)}/versions`,
        { method: "GET" },
        userId
      );
    },

    revertToVersion(documentId, payload, userId) {
      return request<RevertToVersionResponse>(
        `/documents/${encodeURIComponent(documentId)}/revert`,
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
    },

    async requestRewriteJob(payload, userId) {
      const response = await request<{ jobId: string; statusUrl: string }>(
        "/ai/rewrite",
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
      return {
        ...response,
        status: "PENDING",
      };
    },

    async requestSummarizeJob(payload, userId) {
      const response = await request<{ jobId: string; statusUrl: string }>(
        "/ai/summarize",
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
      return {
        ...response,
        status: "PENDING",
      };
    },

    async requestTranslateJob(payload, userId) {
      const response = await request<{ jobId: string; statusUrl: string }>(
        "/ai/translate",
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
      return {
        ...response,
        status: "PENDING",
      };
    },

    async getAiJobStatus(jobId, userId) {
      const payload = await request<{
        jobId: string;
        status: AiJobResponse["status"];
        result?: { proposedText?: string };
        errorCode?: string;
        errorMessage?: string;
        baseVersionId?: string;
        createdAt?: string;
        updatedAt?: string;
      }>(`/ai/jobs/${encodeURIComponent(jobId)}`, { method: "GET" }, userId);

      return {
        jobId: payload.jobId,
        statusUrl: `/ai/jobs/${payload.jobId}`,
        status: payload.status,
        output: payload.result?.proposedText,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        baseVersionId: payload.baseVersionId,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
      };
    },
  };
}
