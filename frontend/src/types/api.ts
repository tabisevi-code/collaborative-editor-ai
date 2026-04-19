export interface LoginResponse {
  userId: string;
  displayName: string;
  globalRole: "user" | "admin";
  accessToken: string;
  expiresIn: number;
}

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
  preUpdateVersionReason?: string;
  updateReason?: string;
  aiJobId?: string;
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

export type DocumentRole = "owner" | "editor" | "viewer";

export interface DocumentPermissionMember {
  userId: string;
  role: DocumentRole;
  updatedAt: string;
}

export interface ListPermissionsResponse {
  documentId: string;
  members: DocumentPermissionMember[];
}

export interface UpdatePermissionRequest {
  requestId: string;
  targetUserId: string;
  role: Extract<DocumentRole, "editor" | "viewer">;
}

export interface UpdatePermissionResponse {
  documentId: string;
  targetUserId: string;
  role: Extract<DocumentRole, "editor" | "viewer">;
  updatedAt: string;
}

export interface RevokePermissionResponse {
  documentId: string;
  targetUserId: string;
  revoked: boolean;
}

export interface AiPolicyResponse {
  documentId: string;
  aiEnabled: boolean;
  allowedRolesForAI: DocumentRole[];
  dailyQuota: number;
  updatedAt: string;
}

export interface UpdateAiPolicyRequest {
  aiEnabled: boolean;
  allowedRolesForAI: DocumentRole[];
  dailyQuota: number;
}

export type AiAction = "rewrite" | "summarize" | "translate";

export interface TextSelection {
  start: number;
  end: number;
}

export interface RewriteAiJobRequest {
  documentId: string;
  selection: TextSelection;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  instruction: string;
  baseVersionId: string;
  requestId: string;
}

export interface SummarizeAiJobRequest {
  documentId: string;
  selection: TextSelection;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  baseVersionId: string;
  requestId: string;
}

export interface TranslateAiJobRequest {
  documentId: string;
  selection: TextSelection;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  targetLanguage: string;
  baseVersionId: string;
  requestId: string;
}

export interface RewriteAiStreamRequest {
  documentId: string;
  selection: TextSelection;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  instruction?: string;
  baseVersionId: string;
}

export interface SummarizeAiStreamRequest {
  documentId: string;
  selection: TextSelection;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  instruction?: string;
  baseVersionId: string;
}

export interface TranslateAiStreamRequest {
  documentId: string;
  selection: TextSelection;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  instruction?: string;
  targetLanguage: string;
  baseVersionId: string;
}

export interface AiJobResponse {
  jobId: string;
  statusUrl: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  output?: string;
  proposedText?: string;
  errorMessage?: string;
  errorCode?: string;
  baseVersionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AiJobFeedbackDisposition = "applied_full" | "applied_partial" | "rejected";

export interface AiJobFeedbackRequest {
  disposition: AiJobFeedbackDisposition;
  appliedText?: string;
  appliedRange?: TextSelection;
}

export interface AiJobFeedbackResponse {
  jobId: string;
  disposition: AiJobFeedbackDisposition;
  recordedAt: string;
}

export type AiHistoryStatus =
  | "streaming"
  | "completed"
  | "accepted"
  | "edited"
  | "rejected"
  | "cancelled"
  | "failed";

export interface AiHistoryItemResponse {
  id: string;
  documentId: string;
  action: AiAction;
  promptLabel: string;
  outputPreview: string;
  status: AiHistoryStatus;
  createdAt: string;
  jobId: string;
}

export interface AiUsageResponse {
  documentId: string;
  aiEnabled: boolean;
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
  allowedRolesForAI: DocumentRole[];
  currentUserRole: DocumentRole;
  canUseAi: boolean;
  updatedAt: string;
}

export interface CancelAiJobResponse {
  jobId: string;
  cancelled: boolean;
}

export type ExportFormat = "txt" | "json" | "pdf" | "docx";

export interface CreateExportRequest {
  format: ExportFormat;
  requestId?: string;
}

export interface ReadyExportResponse {
  downloadUrl: string;
  expiresAt: string;
  content: string;
  contentType: string;
  fileName: string;
}

export interface ExportJobResponse {
  jobId: string;
  statusUrl: string;
}

export type CreateExportResponse = ReadyExportResponse | ExportJobResponse;

export interface ExportJobStatusResponse {
  jobId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  downloadUrl: string | null;
  expiresAt: string | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface DownloadedExportFile {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export interface RealtimeSessionResponse {
  sessionId: string;
  wsUrl: string;
  role: DocumentRole;
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
