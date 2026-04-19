from __future__ import annotations

import asyncio
import json
import sqlite3

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ..ai import cancel_ai_job, complete_ai_request, create_ai_provider, fail_ai_request, is_ai_job_cancelled, prepare_ai_request, record_ai_feedback
from ..config import Settings, get_settings
from ..deps import get_current_user, get_db
from ..schemas import AiJobFeedbackRequest, AiJobFeedbackResponse, AiRewriteStreamRequest, AiSummarizeStreamRequest, AiTranslateStreamRequest, CancelAiJobResponse

router = APIRouter(prefix="/ai", tags=["ai"])


def encode_sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def normalize_ai_exception(error: Exception) -> tuple[str, str]:
    detail = getattr(error, "detail", None)
    if isinstance(detail, dict) and "error" in detail:
        return detail["error"]["code"], detail["error"]["message"]
    return "AI_FAILED", str(error) or "AI provider request failed"


def _stream_ai_response(
    request: Request,
    db: sqlite3.Connection,
    settings: Settings,
    current_user: dict,
    action: str,
    document_id: str,
    selection_start: int,
    selection_end: int,
    selected_text: str,
    context_before: str,
    context_after: str,
    instruction: str | None,
    target_language: str | None,
    base_version_id: str,
) -> StreamingResponse:
    job_id, provider_request = prepare_ai_request(
        db,
        current_user,
        document_id,
        action,
        selection_start,
        selection_end,
        selected_text,
        context_before,
        context_after,
        instruction,
        target_language,
        base_version_id,
    )
    provider = create_ai_provider(settings)

    async def event_stream():
        chunks: list[str] = []
        try:
            for chunk in provider.stream_text(provider_request):
                if await request.is_disconnected() or is_ai_job_cancelled(db, job_id):
                    cancel_ai_job(db, job_id, current_user)
                    return
                chunks.append(chunk)
                yield encode_sse("token", {"jobId": job_id, "text": chunk})
                await asyncio.sleep(0)

            full_text = "".join(chunks).strip()
            if await request.is_disconnected() or is_ai_job_cancelled(db, job_id):
                cancel_ai_job(db, job_id, current_user)
                return

            complete_ai_request(db, job_id, full_text)
            yield encode_sse("done", {"jobId": job_id, "fullText": full_text})
        except Exception as error:
            code, message = normalize_ai_exception(error)
            fail_ai_request(db, job_id, code, message)
            yield encode_sse("error", {"jobId": job_id, "code": code, "message": message})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/rewrite/stream", summary="Stream rewrite output")
async def stream_rewrite(
    payload: AiRewriteStreamRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return _stream_ai_response(
        request,
        db,
        settings,
        current_user,
        "rewrite",
        payload.document_id,
        payload.selection.start,
        payload.selection.end,
        payload.selected_text,
        payload.context_before,
        payload.context_after,
        payload.instruction,
        None,
        payload.base_version_id,
    )


@router.post("/summarize/stream", summary="Stream summary output")
async def stream_summarize(
    payload: AiSummarizeStreamRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return _stream_ai_response(
        request,
        db,
        settings,
        current_user,
        "summarize",
        payload.document_id,
        payload.selection.start,
        payload.selection.end,
        payload.selected_text,
        payload.context_before,
        payload.context_after,
        payload.instruction,
        None,
        payload.base_version_id,
    )


@router.post("/translate/stream", summary="Stream translation output")
async def stream_translate(
    payload: AiTranslateStreamRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return _stream_ai_response(
        request,
        db,
        settings,
        current_user,
        "translate",
        payload.document_id,
        payload.selection.start,
        payload.selection.end,
        payload.selected_text,
        payload.context_before,
        payload.context_after,
        payload.instruction,
        payload.target_language,
        payload.base_version_id,
    )


@router.post("/jobs/{job_id}/cancel", response_model=CancelAiJobResponse, summary="Cancel an in-progress AI stream")
def cancel_job(job_id: str, current_user=Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)) -> CancelAiJobResponse:
    return CancelAiJobResponse(job_id=job_id, cancelled=cancel_ai_job(db, job_id, current_user))


@router.post("/jobs/{job_id}/feedback", response_model=AiJobFeedbackResponse, summary="Record AI feedback")
def record_feedback(
    job_id: str,
    payload: AiJobFeedbackRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AiJobFeedbackResponse:
    return AiJobFeedbackResponse.model_validate(record_ai_feedback(db, current_user, job_id, payload))
