import {
  ApiError,
  type ApiErrorShape,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type GetDocumentResponse,
} from "../types/api";

type FetchLike = typeof fetch;

export interface ApiClient {
  createDocument(payload: CreateDocumentRequest, userId?: string): Promise<CreateDocumentResponse>;
  getDocument(documentId: string, userId?: string): Promise<GetDocumentResponse>;
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

/**
 * The client mirrors the backend contract and centralizes header handling.
 * That keeps page components focused on UX state instead of transport details.
 */
export function createApiClient(baseUrl: string, fetchImpl: FetchLike = fetch): ApiClient {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);

  async function request<T>(path: string, init: RequestInit, userId?: string): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    if (userId?.trim()) {
      headers.set("x-user-id", userId.trim());
    }

    console.info("[frontend-api] request", {
      method: init.method || "GET",
      url: `${resolvedBaseUrl}${path}`,
      userId,
    });

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
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        userId
      );
    },
    getDocument(documentId, userId) {
      return request<GetDocumentResponse>(
        `/documents/${encodeURIComponent(documentId)}`,
        {
          method: "GET",
        },
        userId
      );
    },
  };
}
