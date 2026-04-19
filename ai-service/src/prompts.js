"use strict";

function buildPromptLabel(input) {
  if (input.action === "translate") {
    return `Translate to ${input.targetLanguage || "target language"}`;
  }

  if (input.action === "summarize") {
    return "Summarize selection";
  }

  return input.instruction || "Rewrite selection";
}

function buildSystemPrompt(input) {
  if (input.action === "summarize") {
    return "You are a concise writing assistant. Summarize the selected passage faithfully and clearly. Return only the summary text with no labels or commentary.";
  }

  if (input.action === "translate") {
    return "You are a translation assistant. Translate the selected passage while preserving meaning and tone. Return only the translated text with no labels or commentary.";
  }

  return "You are a writing assistant. Rewrite the selected passage according to the user's instruction while preserving intent. Return only the rewritten text with no labels or commentary.";
}

function buildUserPrompt(input) {
  const sections = [`Selected text:\n${input.selectedText}`];

  if (input.contextBefore) {
    sections.push(`Context before:\n${input.contextBefore}`);
  }

  if (input.contextAfter) {
    sections.push(`Context after:\n${input.contextAfter}`);
  }

  if (input.action === "rewrite") {
    sections.push(`Instruction:\n${input.instruction || "Rewrite this selection."}`);
  }

  if (input.action === "summarize") {
    sections.push(`Instruction:\n${input.instruction || "Summarize the selected text clearly and accurately."}`);
  }

  if (input.action === "translate") {
    sections.push(`Target language:\n${input.targetLanguage || "English"}`);
    if (input.instruction) {
      sections.push(`Additional instruction:\n${input.instruction}`);
    }
  }

  return sections.join("\n\n");
}

function buildPromptPayload(input) {
  return {
    systemPrompt: buildSystemPrompt(input),
    userPrompt: buildUserPrompt(input),
  };
}

module.exports = {
  buildPromptLabel,
  buildPromptPayload,
  buildSystemPrompt,
  buildUserPrompt,
};
