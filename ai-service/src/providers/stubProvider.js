"use strict";

function summarizeText(selectedText) {
  const words = selectedText.trim().split(/\s+/).filter(Boolean);
  const preview = words.slice(0, 12).join(" ");
  return words.length > 12 ? `${preview}...` : preview;
}

/**
 * The stub provider keeps the async job pipeline fully exercised even when no
 * external model endpoint is available. This is the safest local/demo default.
 */
function createStubProvider() {
  return {
    async generateText(input) {
      const source = input.selectedText.trim();

      if (input.action === "summarize") {
        return {
          proposedText: `Summary: ${summarizeText(source)}`,
        };
      }

      if (input.action === "translate") {
        const targetLanguage = input.targetLanguage || "English";
        return {
          proposedText: `[${targetLanguage}] ${source}`,
        };
      }

      const instruction = input.instruction || "Rewrite this selection";
      return {
        proposedText: `${source}\n\nRewritten (${instruction}): ${source}`,
      };
    },
  };
}

module.exports = { createStubProvider };
