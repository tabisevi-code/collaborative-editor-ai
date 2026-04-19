from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def to_camel(field_name: str) -> str:
    parts = field_name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


IDENTIFIER_PATTERN = r"^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,127})$"


class HealthResponse(BaseModel):
    ok: bool = True

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RegisterRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=128, pattern=IDENTIFIER_PATTERN)
    display_name: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=8, max_length=256)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=128, pattern=IDENTIFIER_PATTERN)
    password: str = Field(min_length=1, max_length=256)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AuthResponse(BaseModel):
    user_id: str
    display_name: str
    access_token: str
    refresh_token: str
    expires_in: int

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class MeResponse(BaseModel):
    user_id: str
    display_name: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LogoutResponse(BaseModel):
    revoked: bool

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=128, pattern=IDENTIFIER_PATTERN)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ForgotPasswordResponse(BaseModel):
    accepted: bool
    message: str
    reset_token: str | None = None
    expires_at: str | None = None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ResetPasswordRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=128, pattern=IDENTIFIER_PATTERN)
    reset_token: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ResetPasswordResponse(BaseModel):
    reset: bool

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


DocumentRole = Literal["owner", "editor", "viewer"]
AiAction = Literal["rewrite", "summarize", "translate"]


class DocumentSummary(BaseModel):
    document_id: str
    title: str
    role: DocumentRole
    updated_at: str
    owner_display_name: str | None = None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DocumentListResponse(BaseModel):
    owned: list[DocumentSummary]
    shared: list[DocumentSummary]

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CreateDocumentRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = ""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CreateDocumentResponse(BaseModel):
    document_id: str
    title: str
    owner_id: str
    created_at: str
    updated_at: str
    current_version_id: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class GetDocumentResponse(BaseModel):
    document_id: str
    title: str
    content: str
    updated_at: str
    current_version_id: str
    role: DocumentRole
    revision_id: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class UpdateDocumentRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=128)
    content: str
    base_revision_id: str = Field(min_length=1, max_length=128)
    pre_update_version_reason: str | None = Field(default=None, max_length=128)
    update_reason: str | None = Field(default=None, max_length=128)
    ai_job_id: str | None = Field(default=None, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class UpdateDocumentResponse(BaseModel):
    document_id: str
    updated_at: str
    revision_id: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class VersionSummary(BaseModel):
    version_id: str
    version_number: int
    created_at: str
    created_by: str
    reason: str
    snapshot_content: str | None = None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class VersionListResponse(BaseModel):
    document_id: str
    versions: list[VersionSummary]

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RevertRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=128)
    target_version_id: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RevertResponse(BaseModel):
    document_id: str
    current_version_id: str
    reverted_from_version_id: str
    updated_at: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PermissionUpdateRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=128)
    target_user_id: str = Field(min_length=1, max_length=128)
    role: Literal["editor", "viewer"]

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PermissionEntry(BaseModel):
    user_id: str
    role: DocumentRole
    updated_at: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PermissionListResponse(BaseModel):
    document_id: str
    members: list[PermissionEntry]

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PermissionUpdateResponse(BaseModel):
    document_id: str
    target_user_id: str
    role: Literal["editor", "viewer"]
    updated_at: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RevokePermissionResponse(BaseModel):
    document_id: str
    target_user_id: str
    revoked: bool

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CreateShareLinkRequest(BaseModel):
    role: Literal["editor", "viewer"]
    expires_in_hours: int = Field(default=168, ge=1, le=24 * 30)
    request_id: str | None = Field(default=None, min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ShareLinkSummary(BaseModel):
    link_id: str
    role: Literal["editor", "viewer"]
    created_at: str
    expires_at: str
    revoked_at: str | None = None
    last_claimed_at: str | None = None
    active: bool
    revoked_access_count: int | None = None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ShareLinkCreateResponse(ShareLinkSummary):
    share_token: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ShareLinkListResponse(BaseModel):
    document_id: str
    links: list[ShareLinkSummary]

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ShareLinkPreviewResponse(BaseModel):
    document_id: str
    document_title: str
    role: Literal["editor", "viewer"]
    expires_at: str
    owner_display_name: str | None = None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AcceptShareLinkResponse(BaseModel):
    document_id: str
    role: DocumentRole
    accepted: bool

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiPolicyResponse(BaseModel):
    document_id: str
    ai_enabled: bool
    allowed_roles_for_ai: list[DocumentRole] = Field(alias="allowedRolesForAI")
    daily_quota: int
    used_today: int = 0
    remaining_today: int = 0
    updated_at: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiUsageResponse(BaseModel):
    document_id: str
    ai_enabled: bool
    daily_quota: int
    used_today: int
    remaining_today: int
    allowed_roles_for_ai: list[DocumentRole] = Field(alias="allowedRolesForAI")
    current_user_role: DocumentRole = Field(alias="currentUserRole")
    can_use_ai: bool = Field(alias="canUseAi")

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class UpdateAiPolicyRequest(BaseModel):
    ai_enabled: bool
    allowed_roles_for_ai: list[DocumentRole] = Field(alias="allowedRolesForAI")
    daily_quota: int = Field(ge=1)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionResponse(BaseModel):
    session_id: str
    ws_url: str
    session_token: str
    role: DocumentRole

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TextSelection(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(gt=0)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiRewriteStreamRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=128)
    selection: TextSelection
    selected_text: str = Field(min_length=1)
    context_before: str = ""
    context_after: str = ""
    instruction: str = Field(min_length=1, max_length=200)
    base_version_id: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiSummarizeStreamRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=128)
    selection: TextSelection
    selected_text: str = Field(min_length=1)
    context_before: str = ""
    context_after: str = ""
    instruction: str | None = Field(default=None, max_length=200)
    base_version_id: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiTranslateStreamRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=128)
    selection: TextSelection
    selected_text: str = Field(min_length=1)
    context_before: str = ""
    context_after: str = ""
    target_language: str = Field(min_length=1, max_length=64)
    instruction: str | None = Field(default=None, max_length=200)
    base_version_id: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiHistoryItem(BaseModel):
    id: str
    document_id: str
    action: AiAction
    prompt_label: str
    output_preview: str
    status: str
    created_at: str
    job_id: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


AiFeedbackDisposition = Literal["applied_full", "applied_partial", "rejected"]


class AiJobFeedbackRequest(BaseModel):
    disposition: AiFeedbackDisposition
    applied_text: str | None = None
    applied_range: TextSelection | None = None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AiJobFeedbackResponse(BaseModel):
    job_id: str
    disposition: AiFeedbackDisposition
    recorded_at: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CancelAiJobResponse(BaseModel):
    job_id: str
    cancelled: bool

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


ExportFormat = Literal["txt", "json", "pdf", "docx"]


class CreateExportRequest(BaseModel):
    format: ExportFormat
    request_id: str | None = Field(default=None, min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ReadyExportResponse(BaseModel):
    download_url: str
    expires_at: str
    content: str
    content_type: str
    file_name: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ExportJobResponse(BaseModel):
    job_id: str
    status_url: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ExportJobStatusResponse(BaseModel):
    job_id: str
    status: str
    download_url: str | None = None
    expires_at: str | None = None
    error_code: str | None = None
    error_message: str | None = None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorEnvelope(BaseModel):
    error: dict
