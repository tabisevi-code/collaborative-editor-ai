import sqlite3

from fastapi import APIRouter, Depends

from ..deps import get_current_user, get_db
from ..schemas import DocumentListResponse, DocumentSummary

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=DocumentListResponse, summary="List owned and shared documents")
def list_documents(
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> DocumentListResponse:
    owned_rows = db.execute(
        "SELECT document_id, title, updated_at FROM documents WHERE owner_user_id = ? ORDER BY updated_at DESC",
        (current_user["user_id"],),
    ).fetchall()

    shared_rows = db.execute(
        """
        SELECT d.document_id, d.title, d.updated_at, p.role, u.display_name AS owner_display_name
        FROM document_permissions p
        JOIN documents d ON d.document_id = p.document_id
        JOIN users u ON u.user_id = d.owner_user_id
        WHERE p.user_id = ? AND d.owner_user_id != ?
        ORDER BY d.updated_at DESC
        """,
        (current_user["user_id"], current_user["user_id"]),
    ).fetchall()

    return DocumentListResponse(
        owned=[
            DocumentSummary(
                document_id=row["document_id"],
                title=row["title"],
                role="owner",
                updated_at=row["updated_at"],
                owner_display_name=current_user["display_name"],
            )
            for row in owned_rows
        ],
        shared=[
            DocumentSummary(
                document_id=row["document_id"],
                title=row["title"],
                role=row["role"],
                updated_at=row["updated_at"],
                owner_display_name=row["owner_display_name"],
            )
            for row in shared_rows
        ],
    )
