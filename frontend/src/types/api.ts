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

export interface UpdateDocumentRequest {
  content: string;
  requestId: string;
  baseRevisionId: string;
}

export interface UpdateDocumentResponse {
  documentId: string;
  updatedAt: string;
  revisionId: string;
}

export interface VersionSummary {
  versionId: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  reason: string;
}

export interface ListVersionsResponse {
  versions: VersionSummary[];
  nextCursor?: string;
}

export interface RevertToVersionRequest {
  requestId: string;
  targetVersionId: string;
}

export interface RevertToVersionResponse {
  documentId: string;
  currentVersionId: string;
  revertedFromVersionId: string;
  updatedAt: string;
}

export type AiAction = "rewrite" | "summarize" | "translate";

export interface TextSelection {
  start: number;
  end: number;
}

export interface RewriteAiJobRequest {
  documentId: string;
  selection: TextSelection;
  instruction: string;
  requestId: string;
}

export interface SummarizeAiJobRequest {
  documentId: string;
  selection: TextSelection;
  requestId: string;
}

export interface TranslateAiJobRequest {
  documentId: string;
  selection: TextSelection;
  targetLanguage: string;
  requestId: string;
}

export interface AiJobResponse {
  jobId: string;
  statusUrl: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  output?: string;
  errorMessage?: string;
  errorCode?: string;
  baseVersionId?: string;
  createdAt?: string;
  updatedAt?: string;
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
