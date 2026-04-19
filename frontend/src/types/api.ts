export interface AuthResponse {
  userId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CurrentUserResponse {
  userId: string;
  displayName: string;
}

export interface LogoutResponse {
  revoked: boolean;
}

export interface ForgotPasswordResponse {
  accepted: boolean;
  message: string;
  resetToken: string | null;
  expiresAt: string | null;
}

export interface ResetPasswordResponse {
  reset: boolean;
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

export type DocumentRole = "owner" | "editor" | "viewer";

export interface DashboardDocumentSummary {
  documentId: string;
  title: string;
  role: DocumentRole;
  updatedAt: string;
  ownerDisplayName?: string;
}

export interface ListDocumentsResponse {
  owned: DashboardDocumentSummary[];
  shared: DashboardDocumentSummary[];
}

export interface GetDocumentResponse {
  documentId: string;
  title: string;
  content: string;
  updatedAt: string;
  currentVersionId: string;
  role: DocumentRole;
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
  snapshotContent?: string | null;
}

export interface ListVersionsResponse {
  documentId: string;
  versions: VersionSummary[];
}

export interface RevertToVersionResponse {
  documentId: string;
  currentVersionId: string;
  revertedFromVersionId: string;
  updatedAt: string;
}

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

export interface CreateShareLinkRequest {
  role: Extract<DocumentRole, "editor" | "viewer">;
  expiresInHours: number;
  requestId?: string;
}

export interface ShareLinkSummary {
  linkId: string;
  role: Extract<DocumentRole, "editor" | "viewer">;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  lastClaimedAt?: string | null;
  active: boolean;
  revokedAccessCount?: number | null;
}

export interface ShareLinkCreateResponse extends ShareLinkSummary {
  shareToken: string;
}

export interface ShareLinkListResponse {
  documentId: string;
  links: ShareLinkSummary[];
}

export interface ShareLinkPreviewResponse {
  documentId: string;
  documentTitle: string;
  role: Extract<DocumentRole, "editor" | "viewer">;
  expiresAt: string;
  ownerDisplayName?: string;
}

export interface AcceptShareLinkResponse {
  documentId: string;
  role: DocumentRole;
  accepted: boolean;
}

export interface AiPolicyResponse {
  documentId: string;
  aiEnabled: boolean;
  allowedRolesForAI: DocumentRole[];
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
  updatedAt: string;
}

export interface UpdateAiPolicyRequest {
  aiEnabled: boolean;
  allowedRolesForAI: DocumentRole[];
  dailyQuota: number;
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
}

export type AiAction = "rewrite" | "summarize" | "translate";

export interface TextSelection {
  start: number;
  end: number;
}

export interface RewriteAiStreamRequest {
  documentId: string;
  selection: TextSelection;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
  instruction: string;
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
  targetLanguage: string;
  instruction?: string;
  baseVersionId: string;
}

export interface AiHistoryItemResponse {
  id: string;
  documentId: string;
  action: AiAction;
  promptLabel: string;
  outputPreview: string;
  status: "streaming" | "completed" | "accepted" | "edited" | "rejected" | "cancelled" | "failed";
  createdAt: string;
  jobId: string;
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
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "streaming" | "completed";
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
  sessionToken: string;
  role: DocumentRole;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

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
