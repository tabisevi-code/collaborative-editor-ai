from pydantic import BaseModel, ConfigDict, Field


def to_camel(field_name: str) -> str:
    parts = field_name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class HealthResponse(BaseModel):
    ok: bool = True

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RegisterRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=128)
    display_name: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=8, max_length=256)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=128)
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


class DocumentSummary(BaseModel):
    document_id: str
    title: str
    role: str
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
    role: str
    revision_id: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class UpdateDocumentRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=128)
    content: str
    base_revision_id: str = Field(min_length=1, max_length=128)

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
    role: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PermissionEntry(BaseModel):
    user_id: str
    role: str
    updated_at: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PermissionListResponse(BaseModel):
    document_id: str
    members: list[PermissionEntry]

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionResponse(BaseModel):
    session_id: str
    ws_url: str
    role: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorEnvelope(BaseModel):
    error: dict
