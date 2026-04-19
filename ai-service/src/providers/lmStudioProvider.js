"use strict";

const { AiServiceError } = require("../errors");
const { buildPromptPayload } = require("../prompts");

function resolveFetch(fetchImpl) {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof fetch !== "function") {
    throw new Error("A global fetch implementation is required");
  }

  return fetch;
}

function chunkText(value, chunkSize = 8) {
  const chunks = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }

  return chunks;
}

/**
 * LM Studio exposes an OpenAI-compatible chat completions endpoint. The
 * adapter hides that transport detail so the rest of the AI service only
 * depends on the neutral generateText contract.
 */
function createLmStudioProvider(options = {}) {
  const fetchImpl = resolveFetch(options.fetch);
  const endpoint = options.endpoint || "http://127.0.0.1:1234/v1/chat/completions";
  const model = options.model || "local-model";
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 15000;

  async function requestCompletion(input) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const promptPayload = buildPromptPayload(input);

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": input.requestId,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: promptPayload.systemPrompt },
            { role: "user", content: promptPayload.userPrompt },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AiServiceError(
          response.status === 429 ? "QUOTA_EXCEEDED" : "AI_FAILED",
          `provider responded with HTTP ${response.status}`
        );
      }

      const payload = await response.json();
      const proposedText = payload?.choices?.[0]?.message?.content;
      if (typeof proposedText !== "string" || proposedText.trim().length === 0) {
        throw new AiServiceError("AI_FAILED", "provider returned an empty completion");
      }

      return proposedText.trim();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new AiServiceError("AI_TIMEOUT", "AI request timed out");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async generateText(input) {
      const proposedText = await requestCompletion(input);
      return { proposedText };
    },

    async streamText(input) {
      const proposedText = await requestCompletion(input);
      return chunkText(proposedText);
    },
  };
}

module.exports = { createLmStudioProvider };
