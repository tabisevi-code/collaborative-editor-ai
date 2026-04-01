"use strict";

const ACTION_TO_SYSTEM_PROMPT = Object.freeze({
  rewrite:
    "You rewrite the selected text only. Return only the rewritten text with no explanation, no quotes, and no preamble.",
  summarize:
    "You summarize the selected text only. Return only the summary text with no explanation, no title, and no preamble.",
  translate:
    "You translate the selected text only. Return only the translated text with no explanation, no quotes, and no preamble.",
});

function formatContextLabel(label, value) {
  if (!value) {
    return `${label}: (empty)`;
  }

  return `${label}:\n${value}`;
}

/**
 * The prompt shape makes context explicit so future providers receive the same
 * intent regardless of transport format, while still obeying the requirement
 * to send only the selected text plus minimal surrounding context.
 */
function buildPromptPayload(input) {
  const instructionLine =
    input.action === "translate"
      ? `Target language: ${input.targetLanguage}`
      : `Instruction: ${input.instruction || "Use the default behavior for this action."}`;

  const userPrompt = [
    `Action: ${input.action}`,
    instructionLine,
    formatContextLabel("Context before", input.contextBefore),
    formatContextLabel("Selected text", input.selectedText),
    formatContextLabel("Context after", input.contextAfter),
    "Important: Respond with only the transformed selected text.",
  ].join("\n\n");

  return {
    systemPrompt: ACTION_TO_SYSTEM_PROMPT[input.action],
    userPrompt,
  };
}

module.exports = {
  buildPromptPayload,
};
