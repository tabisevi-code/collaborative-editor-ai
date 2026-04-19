"use strict";

function summarizeText(selectedText) {
  const words = selectedText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "";
  }

  const preview = words.slice(0, 8).join(" ");
  return words.length > 8 ? `${preview}...` : preview;
}

function rewriteText(selectedText, instruction) {
  const normalized = selectedText.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  let rewritten = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  const instructionText = String(instruction || "").toLowerCase();
  if (["concise", "short", "brief"].some((keyword) => instructionText.includes(keyword))) {
    const words = rewritten.split(" ");
    rewritten = words.slice(0, Math.max(3, Math.min(words.length, 6))).join(" ");
  }

  if (!/[.!?]$/.test(rewritten)) {
    rewritten += ".";
  }

  return rewritten;
}

const PHRASE_TRANSLATIONS = Object.freeze({
  chinese: {
    "project brief for testing": "测试用项目简介",
    "hello collaborative world": "你好，协作文档世界",
  },
  japanese: {
    "project brief for testing": "テスト用のプロジェクト概要",
    "hello collaborative world": "こんにちは、共同編集の世界",
  },
});

const WORD_TRANSLATIONS = Object.freeze({
  chinese: {
    project: "项目",
    brief: "简介",
    for: "用于",
    testing: "测试",
    hello: "你好",
    collaborative: "协作",
    world: "世界",
  },
  japanese: {
    project: "プロジェクト",
    brief: "概要",
    for: "用",
    testing: "テスト",
    hello: "こんにちは",
    collaborative: "共同編集",
    world: "世界",
  },
});

function translateText(selectedText, targetLanguage) {
  const normalizedText = selectedText.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalizedText) {
    return "";
  }

  const normalizedLanguage = String(targetLanguage || "English").trim().toLowerCase();
  const phraseTranslation = PHRASE_TRANSLATIONS[normalizedLanguage]?.[normalizedText];
  if (phraseTranslation) {
    return phraseTranslation;
  }

  const dictionary = WORD_TRANSLATIONS[normalizedLanguage] || {};
  const translatedWords = normalizedText
    .split(" ")
    .map((word) => dictionary[word] || word);

  if (normalizedLanguage === "chinese" || normalizedLanguage === "japanese") {
    return translatedWords.join("");
  }

  return translatedWords.join(" ");
}

function chunkText(value, chunkSize = 8) {
  const chunks = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }

  return chunks;
}

/**
 * The stub provider keeps the async job pipeline fully exercised even when no
 * external model endpoint is available. This is the safest local/demo default.
 */
function createStubProvider() {
  function buildOutput(input) {
    if (input.action === "summarize") {
      return summarizeText(input.selectedText);
    }

    if (input.action === "translate") {
      return translateText(input.selectedText, input.targetLanguage);
    }

    return rewriteText(input.selectedText, input.instruction);
  }

  return {
    streamText(input) {
      return chunkText(buildOutput(input));
    },

    async generateText(input) {
      return {
        proposedText: buildOutput(input),
      };
    },
  };
}

module.exports = { createStubProvider };
