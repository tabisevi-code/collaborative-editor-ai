from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .providers import AiProviderRequest


def build_prompt_label(request: AiProviderRequest) -> str:
    if request.action == "translate":
        return f"Translate to {request.target_language or 'target language'}"
    if request.action == "summarize":
        return "Summarize selection"
    return request.instruction or "Rewrite selection"


def build_system_prompt(request: AiProviderRequest) -> str:
    if request.action == "summarize":
        return "You are a concise writing assistant. Summarize the selected passage faithfully and clearly. Return only the summary text with no labels or commentary."
    if request.action == "translate":
        return "You are a translation assistant. Translate the selected passage while preserving meaning and tone. Return only the translated text with no labels or commentary."
    return "You are a writing assistant. Rewrite the selected passage according to the user's instruction while preserving intent. Return only the rewritten text with no labels or commentary."


def build_user_prompt(request: AiProviderRequest) -> str:
    sections = [
        f"Selected text:\n{request.selected_text}",
    ]
    if request.context_before:
        sections.append(f"Context before:\n{request.context_before}")
    if request.context_after:
        sections.append(f"Context after:\n{request.context_after}")
    if request.action == "rewrite":
        sections.append(f"Instruction:\n{request.instruction or 'Rewrite this selection.'}")
    if request.action == "translate":
        sections.append(f"Target language:\n{request.target_language or 'English'}")
        if request.instruction:
            sections.append(f"Additional instruction:\n{request.instruction}")
    if request.action == "summarize":
        sections.append(f"Instruction:\n{request.instruction or 'Summarize the selected text clearly and accurately.'}")
    return "\n\n".join(sections)
