from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/rewrite/stream", summary="Stream rewrite output")
def stream_rewrite_placeholder():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Streaming AI rewrite is reserved for the dedicated AI workstream and is not implemented in the backend foundation slice.",
            }
        },
    )


@router.post("/summarize/stream", summary="Stream summary output")
def stream_summarize_placeholder():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Streaming AI summarize is reserved for the dedicated AI workstream and is not implemented in the backend foundation slice.",
            }
        },
    )


@router.post("/translate/stream", summary="Stream translation output")
def stream_translate_placeholder():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Streaming AI translate is reserved for the dedicated AI workstream and is not implemented in the backend foundation slice.",
            }
        },
    )


@router.get("/history/{document_id}", summary="List AI interaction history for a document")
def ai_history_placeholder(document_id: str):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": f"AI history for document {document_id} is reserved for the dedicated AI workstream and is not implemented in the backend foundation slice.",
            }
        },
    )
