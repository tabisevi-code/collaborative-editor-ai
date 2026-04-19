from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Iterable, Protocol

import httpx

from ..config import Settings
from ..errors import api_error
from .prompts import build_system_prompt, build_user_prompt


@dataclass(frozen=True)
class AiProviderRequest:
    action: str
    selected_text: str
    context_before: str
    context_after: str
    instruction: str | None
    target_language: str | None
    request_id: str


class AiProvider(Protocol):
    def stream_text(self, request: AiProviderRequest) -> Iterable[str]:
        ...


def chunk_text(value: str, chunk_size: int = 8) -> Iterable[str]:
    for index in range(0, len(value), chunk_size):
        yield value[index : index + chunk_size]


def summarize_text(selected_text: str) -> str:
    words = [word for word in selected_text.strip().split() if word]
    if not words:
        return ""
    preview = " ".join(words[:8])
    return f"{preview}..." if len(words) > 8 else preview


def rewrite_text(selected_text: str, instruction: str | None = None) -> str:
    normalized = " ".join(selected_text.strip().split())
    if not normalized:
        return ""
    rewritten = normalized[0].upper() + normalized[1:]
    instruction_text = (instruction or "").lower()
    if any(keyword in instruction_text for keyword in ["concise", "short", "brief"]):
        words = rewritten.split()
        rewritten = " ".join(words[: max(3, min(len(words), 6))])
    if rewritten[-1] not in ".!?":
        rewritten += "."
    return rewritten


PHRASE_TRANSLATIONS = {
    "chinese": {
        "project brief for testing": "测试用项目简介",
        "hello collaborative world": "你好，协作文档世界",
    },
    "japanese": {
        "project brief for testing": "テスト用のプロジェクト概要",
        "hello collaborative world": "こんにちは、共同編集の世界",
    },
}


WORD_TRANSLATIONS = {
    "chinese": {
        "project": "项目",
        "brief": "简介",
        "for": "用于",
        "testing": "测试",
        "hello": "你好",
        "collaborative": "协作",
        "world": "世界",
    },
    "japanese": {
        "project": "プロジェクト",
        "brief": "概要",
        "for": "用",
        "testing": "テスト",
        "hello": "こんにちは",
        "collaborative": "共同編集",
        "world": "世界",
    },
}


def translate_text(selected_text: str, target_language: str | None) -> str:
    normalized_language = (target_language or "english").strip().lower()
    normalized_text = " ".join(selected_text.strip().split()).lower()
    if not normalized_text:
        return ""

    phrase_translation = PHRASE_TRANSLATIONS.get(normalized_language, {}).get(normalized_text)
    if phrase_translation:
        return phrase_translation

    words = normalized_text.split()
    dictionary = WORD_TRANSLATIONS.get(normalized_language, {})
    translated_words = [dictionary.get(word, word) for word in words]

    if normalized_language == "chinese":
        return "".join(translated_words)
    if normalized_language == "japanese":
        return "".join(translated_words)
    return " ".join(translated_words)


class StubAiProvider:
    def stream_text(self, request: AiProviderRequest) -> Iterable[str]:
        source = request.selected_text.strip()
        if request.action == "summarize":
            text = summarize_text(source)
        elif request.action == "translate":
            text = translate_text(source, request.target_language)
        else:
            text = rewrite_text(source, request.instruction)
        yield from chunk_text(text)


class OpenAICompatibleProvider:
    def __init__(self, settings: Settings):
        self.endpoint = settings.ai_provider_endpoint
        self.model = settings.ai_model
        self.timeout = settings.ai_timeout_ms / 1000

    def stream_text(self, request: AiProviderRequest) -> Iterable[str]:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": build_system_prompt(request)},
                {"role": "user", "content": build_user_prompt(request)},
            ],
            "temperature": 0.2,
        }

        try:
            response = httpx.post(
                self.endpoint,
                headers={
                    "Content-Type": "application/json",
                    "X-Request-Id": request.request_id,
                },
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            body = response.json()
        except httpx.TimeoutException as error:
            raise api_error(504, "AI_TIMEOUT", "AI request timed out") from error
        except httpx.HTTPStatusError as error:
            code = "QUOTA_EXCEEDED" if error.response.status_code == 429 else "AI_FAILED"
            raise api_error(502, code, f"provider responded with HTTP {error.response.status_code}") from error
        except (ValueError, json.JSONDecodeError) as error:
            raise api_error(502, "AI_FAILED", "provider returned invalid JSON") from error
        except httpx.HTTPError as error:
            raise api_error(502, "AI_FAILED", "AI provider request failed") from error

        proposed_text = body.get("choices", [{}])[0].get("message", {}).get("content")
        if not isinstance(proposed_text, str) or proposed_text.strip() == "":
            raise api_error(502, "AI_FAILED", "provider returned an empty completion")

        yield from chunk_text(proposed_text.strip())


def create_ai_provider(settings: Settings) -> AiProvider:
    if settings.ai_stream_provider == "lmstudio":
        return OpenAICompatibleProvider(settings)
    return StubAiProvider()
