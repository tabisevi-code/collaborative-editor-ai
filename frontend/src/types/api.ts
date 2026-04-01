export interface CreateDocumentRequest {
  title: string;
  content?: string;
}

export interface CreateDocumentResponse {
  documentId: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  currentVersionId: string;
}

export interface GetDocumentResponse {
  documentId: string;
  title: string;
  content: string;
  updatedAt: string;
  currentVersionId: string;
  role: "owner" | "editor" | "viewer";
  revisionId: string;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * A dedicated error object keeps HTTP metadata attached so UI code can map
 * backend failures to friendly banners without losing the original reason.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
