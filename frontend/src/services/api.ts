import {
  ApiError,
  type ApiErrorShape,
  type AiAction,
  type AiHistoryItemResponse,
  type AiUsageResponse,
  type CancelAiJobResponse,
  type AiJobResponse,
  type AiJobFeedbackRequest,
  type AiJobFeedbackResponse,
  type AiPolicyResponse,
  type CreateExportRequest,
  type CreateExportResponse,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type DownloadedExportFile,
  type ExportJobStatusResponse,
  type GetDocumentResponse,
  type LoginResponse,
  type ListVersionsResponse,
  type ListPermissionsResponse,
  type RealtimeSessionResponse,
  type RevokePermissionResponse,
  type RevertToVersionResponse,
  type RewriteAiJobRequest,
  type RewriteAiStreamRequest,
  type SummarizeAiJobRequest,
  type SummarizeAiStreamRequest,
  type TranslateAiJobRequest,
  type TranslateAiStreamRequest,
  type UpdateAiPolicyRequest,
  type UpdateDocumentRequest,
  type UpdateDocumentResponse,
  type UpdatePermissionRequest,
  type UpdatePermissionResponse,
} from "../types/api";

type FetchLike = typeof fetch;

export interface ApiClient {
  login(userId: string): Promise<LoginResponse>;
  createDocument(payload: CreateDocumentRequest, userId?: string): Promise<CreateDocumentResponse>;
  getDocument(documentId: string, userId?: string): Promise<GetDocumentResponse>;
  updateDocument(documentId: string, payload: UpdateDocumentRequest, userId?: string): Promise<UpdateDocumentResponse>;
  listVersions(documentId: string, userId?: string): Promise<ListVersionsResponse>;
  listPermissions(documentId: string, userId?: string): Promise<ListPermissionsResponse>;
  updatePermission(
    documentId: string,
    payload: UpdatePermissionRequest,
    userId?: string
  ): Promise<UpdatePermissionResponse>;
  revokePermission(documentId: string, targetUserId: string, userId?: string): Promise<RevokePermissionResponse>;
  getAiPolicy(documentId: string, userId?: string): Promise<AiPolicyResponse>;
  updateAiPolicy(
    documentId: string,
    payload: UpdateAiPolicyRequest,
    userId?: string
  ): Promise<AiPolicyResponse>;
  revertToVersion(
    documentId: string,
    payload: { requestId: string; targetVersionId: string },
    userId?: string
  ): Promise<RevertToVersionResponse>;
  requestRewriteJob(payload: RewriteAiJobRequest, userId?: string): Promise<AiJobResponse>;
  requestSummarizeJob(payload: SummarizeAiJobRequest, userId?: string): Promise<AiJobResponse>;
  requestTranslateJob(payload: TranslateAiJobRequest, userId?: string): Promise<AiJobResponse>;
  startAiStream(
    action: AiAction,
    payload: RewriteAiStreamRequest | SummarizeAiStreamRequest | TranslateAiStreamRequest,
    signal?: AbortSignal,
    userId?: string
  ): Promise<Response>;
  getAiJobStatus(jobId: string, userId?: string): Promise<AiJobResponse>;
  listAiHistory(documentId: string, userId?: string): Promise<AiHistoryItemResponse[]>;
  getAiUsage(documentId: string, userId?: string): Promise<AiUsageResponse>;
  cancelAiJob(jobId: string, userId?: string): Promise<CancelAiJobResponse>;
  recordAiJobFeedback(jobId: string, payload: AiJobFeedbackRequest, userId?: string): Promise<AiJobFeedbackResponse>;
  createExport(
    documentId: string,
    payload: CreateExportRequest,
    userId?: string
  ): Promise<CreateExportResponse>;
  getExportJobStatus(jobId: string, userId?: string): Promise<ExportJobStatusResponse>;
  downloadExport(jobId: string, userId?: string): Promise<DownloadedExportFile>;
  createSession(documentId: string, userId?: string): Promise<RealtimeSessionResponse>;
}

const accessTokenCache = new Map<string, LoginResponse>();

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

function parseContentDispositionFileName(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const utf8Match = headerValue.match(/filename\*\=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = headerValue.match(/filename=\"([^\"]+)\"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const bareMatch = headerValue.match(/filename=([^;]+)/i);
  return bareMatch?.[1]?.trim() || null;
}

export function createApiClient(baseUrl: string, fetchImpl: FetchLike = fetch): ApiClient {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);

  async function login(userId: string): Promise<LoginResponse> {
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

    const typedPayload = payload as LoginResponse;
    accessTokenCache.set(normalizedUserId, typedPayload);
    return typedPayload;
  }

  async function request<T>(path: string, init: RequestInit, userId?: string): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    try {
      if (userId?.trim()) {
        const loginResponse = await login(userId);
        headers.set("Authorization", `Bearer ${loginResponse.accessToken}`);
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

  async function requestBlob(path: string, init: RequestInit, userId?: string): Promise<DownloadedExportFile> {
    const headers = new Headers(init.headers);

    try {
      if (userId?.trim()) {
        const loginResponse = await login(userId);
        headers.set("Authorization", `Bearer ${loginResponse.accessToken}`);
      }

      console.info("[frontend-api] request_blob", {
        method: init.method || "GET",
        url: `${resolvedBaseUrl}${path}`,
        userId,
      });

      const response = await fetchImpl(`${resolvedBaseUrl}${path}`, {
        ...init,
        headers,
      });

      if (!response.ok) {
        const payload = await parseJson(response);
        throw toApiError(response.status, payload);
      }

      const blob = await response.blob();
      return {
        blob,
        fileName:
          parseContentDispositionFileName(response.headers.get("Content-Disposition")) || "download.bin",
        contentType: response.headers.get("Content-Type") || "application/octet-stream",
      };
    } catch (error) {
      throw toUnexpectedError(error);
    }
  }

  async function requestResponse(path: string, init: RequestInit, userId?: string): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    try {
      if (userId?.trim()) {
        const loginResponse = await login(userId);
        headers.set("Authorization", `Bearer ${loginResponse.accessToken}`);
      }

      const response = await fetchImpl(`${resolvedBaseUrl}${path}`, {
        ...init,
        headers,
      });

      if (!response.ok) {
        const payload = await parseJson(response);
        throw toApiError(response.status, payload);
      }

      return response;
    } catch (error) {
      throw toUnexpectedError(error);
    }
  }

  return {
    login,
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

    listPermissions(documentId, userId) {
      return request<ListPermissionsResponse>(
        `/documents/${encodeURIComponent(documentId)}/permissions`,
        { method: "GET" },
        userId
      );
    },

    updatePermission(documentId, payload, userId) {
      return request<UpdatePermissionResponse>(
        `/documents/${encodeURIComponent(documentId)}/permissions`,
        { method: "PUT", body: JSON.stringify(payload) },
        userId
      );
    },

    revokePermission(documentId, targetUserId, userId) {
      return request<RevokePermissionResponse>(
        `/documents/${encodeURIComponent(documentId)}/permissions/${encodeURIComponent(targetUserId)}`,
        { method: "DELETE" },
        userId
      );
    },

    getAiPolicy(documentId, userId) {
      return request<AiPolicyResponse>(
        `/documents/${encodeURIComponent(documentId)}/ai-policy`,
        { method: "GET" },
        userId
      );
    },

    updateAiPolicy(documentId, payload, userId) {
      return request<AiPolicyResponse>(
        `/documents/${encodeURIComponent(documentId)}/ai-policy`,
        { method: "PUT", body: JSON.stringify(payload) },
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
      const response = await request<{
        jobId: string;
        status?: AiJobResponse["status"];
        statusUrl?: string;
        baseVersionId?: string;
        createdAt?: string;
        updatedAt?: string;
      }>(
        "/ai/rewrite",
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
      return {
        ...response,
        statusUrl: response.statusUrl || `/ai/jobs/${response.jobId}`,
        status: response.status || "PENDING",
      };
    },

    async requestSummarizeJob(payload, userId) {
      const response = await request<{
        jobId: string;
        status?: AiJobResponse["status"];
        statusUrl?: string;
        baseVersionId?: string;
        createdAt?: string;
        updatedAt?: string;
      }>(
        "/ai/summarize",
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
      return {
        ...response,
        statusUrl: response.statusUrl || `/ai/jobs/${response.jobId}`,
        status: response.status || "PENDING",
      };
    },

    async requestTranslateJob(payload, userId) {
      const response = await request<{
        jobId: string;
        status?: AiJobResponse["status"];
        statusUrl?: string;
        baseVersionId?: string;
        createdAt?: string;
        updatedAt?: string;
      }>(
        "/ai/translate",
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
      return {
        ...response,
        statusUrl: response.statusUrl || `/ai/jobs/${response.jobId}`,
        status: response.status || "PENDING",
      };
    },

    startAiStream(action, payload, signal, userId) {
      return requestResponse(
        `/ai/${encodeURIComponent(action)}/stream`,
        {
          method: "POST",
          body: JSON.stringify(payload),
          signal,
          headers: {
            Accept: "text/event-stream",
          },
        },
        userId
      );
    },

    async getAiJobStatus(jobId, userId) {
      const payload = await request<{
        jobId: string;
        status: AiJobResponse["status"];
        proposedText?: string;
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
        output: payload.proposedText,
        proposedText: payload.proposedText,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        baseVersionId: payload.baseVersionId,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
      };
    },

    listAiHistory(documentId, userId) {
      return request<AiHistoryItemResponse[]>(
        `/documents/${encodeURIComponent(documentId)}/ai-history`,
        { method: "GET" },
        userId
      );
    },

    getAiUsage(documentId, userId) {
      return request<AiUsageResponse>(
        `/documents/${encodeURIComponent(documentId)}/ai-usage`,
        { method: "GET" },
        userId
      );
    },

    cancelAiJob(jobId, userId) {
      return request<CancelAiJobResponse>(
        `/ai/jobs/${encodeURIComponent(jobId)}/cancel`,
        { method: "POST" },
        userId
      );
    },

    recordAiJobFeedback(jobId, payload, userId) {
      return request<AiJobFeedbackResponse>(
        `/ai/jobs/${encodeURIComponent(jobId)}/feedback`,
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
    },

    createExport(documentId, payload, userId) {
      return request<CreateExportResponse>(
        `/documents/${encodeURIComponent(documentId)}/export`,
        { method: "POST", body: JSON.stringify(payload) },
        userId
      );
    },

    getExportJobStatus(jobId, userId) {
      return request<ExportJobStatusResponse>(
        `/exports/${encodeURIComponent(jobId)}`,
        { method: "GET" },
        userId
      );
    },

    downloadExport(jobId, userId) {
      return requestBlob(`/exports/${encodeURIComponent(jobId)}/download`, { method: "GET" }, userId);
    },

    createSession(documentId, userId) {
      return request<RealtimeSessionResponse>(
        "/sessions",
        { method: "POST", body: JSON.stringify({ documentId }) },
        userId
      );
    },
  };
}
