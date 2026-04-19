import {
  ApiError,
  type AiHistoryItemResponse,
  type AiJobResponse,
  type AiJobFeedbackRequest,
  type AiJobFeedbackResponse,
  type AiPolicyResponse,
  type AiUsageResponse,
  type AcceptShareLinkResponse,
  type AuthResponse,
  type CancelAiJobResponse,
  type CreateShareLinkRequest,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type CreateExportRequest,
  type CreateExportResponse,
  type CurrentUserResponse,
  type DownloadedExportFile,
  type ExportJobStatusResponse,
  type ForgotPasswordResponse,
  type GetDocumentResponse,
  type ListDocumentsResponse,
  type ListPermissionsResponse,
  type ListVersionsResponse,
  type LogoutResponse,
  type ReadyExportResponse,
  type RealtimeSessionResponse,
  type ShareLinkCreateResponse,
  type ShareLinkListResponse,
  type ShareLinkPreviewResponse,
  type ShareLinkSummary,
  type RewriteAiStreamRequest,
  type SummarizeAiStreamRequest,
  type TranslateAiStreamRequest,
  type RevokePermissionResponse,
  type RevertToVersionResponse,
  type ResetPasswordResponse,
  type UpdateAiPolicyRequest,
  type UpdateDocumentRequest,
  type UpdateDocumentResponse,
  type UpdatePermissionRequest,
  type UpdatePermissionResponse,
  type ApiErrorShape,
} from "../types/api";

type FetchLike = typeof fetch;
type AiStreamPayload = RewriteAiStreamRequest | SummarizeAiStreamRequest | TranslateAiStreamRequest;

export interface ApiClient {
  setSession(session: { accessToken: string } | null): void;
  login(payload: { identifier: string; password: string }): Promise<AuthResponse>;
  register(payload: { identifier: string; displayName: string; password: string }): Promise<AuthResponse>;
  forgotPassword(payload: { identifier: string }): Promise<ForgotPasswordResponse>;
  resetPassword(payload: { identifier: string; resetToken: string; newPassword: string }): Promise<ResetPasswordResponse>;
  refresh(refreshToken: string): Promise<AuthResponse>;
  logout(refreshToken: string): Promise<LogoutResponse>;
  getCurrentUser(): Promise<CurrentUserResponse>;
  listDocuments(_userId?: string): Promise<ListDocumentsResponse>;
  createDocument(payload: CreateDocumentRequest, _userId?: string): Promise<CreateDocumentResponse>;
  getDocument(documentId: string, _userId?: string): Promise<GetDocumentResponse>;
  updateDocument(documentId: string, payload: UpdateDocumentRequest, _userId?: string): Promise<UpdateDocumentResponse>;
  listVersions(documentId: string, _userId?: string): Promise<ListVersionsResponse>;
  listPermissions(documentId: string, _userId?: string): Promise<ListPermissionsResponse>;
  updatePermission(documentId: string, payload: UpdatePermissionRequest, _userId?: string): Promise<UpdatePermissionResponse>;
  revokePermission(documentId: string, targetUserId: string, _userId?: string): Promise<RevokePermissionResponse>;
  listShareLinks(documentId: string, _userId?: string): Promise<ShareLinkListResponse>;
  createShareLink(documentId: string, payload: CreateShareLinkRequest, _userId?: string): Promise<ShareLinkCreateResponse>;
  revokeShareLink(documentId: string, linkId: string, options?: { revokeAccess?: boolean }, _userId?: string): Promise<ShareLinkSummary>;
  previewShareLink(shareToken: string): Promise<ShareLinkPreviewResponse>;
  acceptShareLink(shareToken: string): Promise<AcceptShareLinkResponse>;
  getAiPolicy(documentId: string, _userId?: string): Promise<AiPolicyResponse>;
  getAiUsage(documentId: string, _userId?: string): Promise<AiUsageResponse>;
  updateAiPolicy(documentId: string, payload: UpdateAiPolicyRequest, _userId?: string): Promise<AiPolicyResponse>;
  requestRewriteJob(payload: RewriteAiStreamRequest & { requestId?: string }, _userId?: string): Promise<AiJobResponse>;
  requestSummarizeJob(payload: SummarizeAiStreamRequest & { requestId?: string }, _userId?: string): Promise<AiJobResponse>;
  requestTranslateJob(payload: TranslateAiStreamRequest & { requestId?: string }, _userId?: string): Promise<AiJobResponse>;
  getAiJobStatus(jobId: string, _userId?: string): Promise<AiJobResponse>;
  revertToVersion(documentId: string, payload: { requestId: string; targetVersionId: string }, _userId?: string): Promise<RevertToVersionResponse>;
  startAiStream(action: "rewrite" | "summarize" | "translate", payload: AiStreamPayload, signal?: AbortSignal): Promise<Response>;
  listAiHistory(documentId: string, _userId?: string): Promise<AiHistoryItemResponse[]>;
  cancelAiJob(jobId: string, _userId?: string): Promise<CancelAiJobResponse>;
  recordAiJobFeedback(jobId: string, payload: AiJobFeedbackRequest, _userId?: string): Promise<AiJobFeedbackResponse>;
  createExport(documentId: string, payload: CreateExportRequest, _userId?: string): Promise<CreateExportResponse>;
  getExportJobStatus(jobId: string, _userId?: string): Promise<ExportJobStatusResponse>;
  downloadExport(jobId: string, _userId?: string): Promise<DownloadedExportFile>;
  createSession(documentId: string, _userId?: string): Promise<RealtimeSessionResponse>;
}

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
  let accessToken: string | null = null;

  async function request<T>(path: string, init: RequestInit = {}, options?: { withAuth?: boolean }): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (options?.withAuth !== false && accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    try {
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
      throw toUnexpectedError(error);
    }
  }

  async function requestBlob(path: string, init: RequestInit = {}): Promise<DownloadedExportFile> {
    const headers = new Headers(init.headers);
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    try {
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
        fileName: parseContentDispositionFileName(response.headers.get("Content-Disposition")) || "download.bin",
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
    setSession(session) {
      accessToken = session?.accessToken || null;
    },

    login(payload) {
      return request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }, { withAuth: false });
    },

    register(payload) {
      return request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }, { withAuth: false });
    },

    forgotPassword(payload) {
      return request<ForgotPasswordResponse>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(payload),
      }, { withAuth: false });
    },

    resetPassword(payload) {
      return request<ResetPasswordResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(payload),
      }, { withAuth: false });
    },

    refresh(refreshToken) {
      return request<AuthResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }, { withAuth: false });
    },

    logout(refreshToken) {
      return request<LogoutResponse>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    },

    getCurrentUser() {
      return request<CurrentUserResponse>("/auth/me", { method: "GET" });
    },

    listDocuments() {
      return request<ListDocumentsResponse>("/documents", { method: "GET" });
    },

    createDocument(payload) {
      return request<CreateDocumentResponse>("/documents", { method: "POST", body: JSON.stringify(payload) });
    },

    getDocument(documentId) {
      return request<GetDocumentResponse>(`/documents/${encodeURIComponent(documentId)}`, { method: "GET" });
    },

    updateDocument(documentId, payload) {
      return request<UpdateDocumentResponse>(
        `/documents/${encodeURIComponent(documentId)}/content`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
    },

    listVersions(documentId) {
      return request<ListVersionsResponse>(`/documents/${encodeURIComponent(documentId)}/versions`, { method: "GET" });
    },

    listPermissions(documentId) {
      return request<ListPermissionsResponse>(`/documents/${encodeURIComponent(documentId)}/permissions`, { method: "GET" });
    },

    updatePermission(documentId, payload) {
      return request<UpdatePermissionResponse>(
        `/documents/${encodeURIComponent(documentId)}/permissions`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
    },

    revokePermission(documentId, targetUserId) {
      return request<RevokePermissionResponse>(
        `/documents/${encodeURIComponent(documentId)}/permissions/${encodeURIComponent(targetUserId)}`,
        { method: "DELETE" }
      );
    },

    listShareLinks(documentId) {
      return request<ShareLinkListResponse>(`/documents/${encodeURIComponent(documentId)}/share-links`, { method: "GET" });
    },

    createShareLink(documentId, payload) {
      return request<ShareLinkCreateResponse>(
        `/documents/${encodeURIComponent(documentId)}/share-links`,
        { method: "POST", body: JSON.stringify(payload) }
      );
    },

    revokeShareLink(documentId, linkId, options) {
      const search = new URLSearchParams();
      if (options?.revokeAccess) {
        search.set("revokeAccess", "true");
      }
      return request<ShareLinkSummary>(
        `/documents/${encodeURIComponent(documentId)}/share-links/${encodeURIComponent(linkId)}${search.toString() ? `?${search.toString()}` : ""}`,
        { method: "DELETE" }
      );
    },

    previewShareLink(shareToken) {
      return request<ShareLinkPreviewResponse>(`/share-links/${encodeURIComponent(shareToken)}`, { method: "GET" }, { withAuth: false });
    },

    acceptShareLink(shareToken) {
      return request<AcceptShareLinkResponse>(`/share-links/${encodeURIComponent(shareToken)}/accept`, { method: "POST" });
    },

    getAiPolicy(documentId) {
      return request<AiPolicyResponse>(`/documents/${encodeURIComponent(documentId)}/ai-policy`, { method: "GET" });
    },

    getAiUsage(documentId) {
      return request<AiUsageResponse>(`/documents/${encodeURIComponent(documentId)}/ai-usage`, { method: "GET" });
    },

    updateAiPolicy(documentId, payload) {
      return request<AiPolicyResponse>(
        `/documents/${encodeURIComponent(documentId)}/ai-policy`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
    },

    async requestRewriteJob() {
      throw new ApiError(404, "NOT_IMPLEMENTED", "AI job endpoints are not enabled on this branch.");
    },

    async requestSummarizeJob() {
      throw new ApiError(404, "NOT_IMPLEMENTED", "AI job endpoints are not enabled on this branch.");
    },

    async requestTranslateJob() {
      throw new ApiError(404, "NOT_IMPLEMENTED", "AI job endpoints are not enabled on this branch.");
    },

    async getAiJobStatus() {
      throw new ApiError(404, "NOT_IMPLEMENTED", "AI job endpoints are not enabled on this branch.");
    },

    revertToVersion(documentId, payload) {
      return request<RevertToVersionResponse>(
        `/documents/${encodeURIComponent(documentId)}/revert`,
        { method: "POST", body: JSON.stringify(payload) }
      );
    },

    async startAiStream(action, payload, signal) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }

      const response = await fetchImpl(`${resolvedBaseUrl}/ai/${action}/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const payloadJson = await parseJson(response);
        throw toApiError(response.status, payloadJson);
      }

      return response;
    },

    listAiHistory(documentId) {
      return request<AiHistoryItemResponse[]>(`/documents/${encodeURIComponent(documentId)}/ai-history`, { method: "GET" });
    },

    cancelAiJob(jobId) {
      return request<CancelAiJobResponse>(`/ai/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
    },

    recordAiJobFeedback(jobId, payload) {
      return request<AiJobFeedbackResponse>(`/ai/jobs/${encodeURIComponent(jobId)}/feedback`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async createExport(documentId, payload) {
      const response = await request<CreateExportResponse>(
        `/documents/${encodeURIComponent(documentId)}/export`,
        { method: "POST", body: JSON.stringify(payload) }
      );

      if ("content" in response) {
        return response as ReadyExportResponse;
      }
      return response;
    },

    getExportJobStatus(jobId) {
      return request<ExportJobStatusResponse>(`/exports/${encodeURIComponent(jobId)}`, { method: "GET" });
    },

    downloadExport(jobId) {
      return requestBlob(`/exports/${encodeURIComponent(jobId)}/download`, { method: "GET" });
    },

    createSession(documentId) {
      return request<RealtimeSessionResponse>("/sessions", {
        method: "POST",
        body: JSON.stringify({ documentId }),
      });
    },
  };
}
