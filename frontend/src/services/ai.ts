import type {
  AiAction,
  AiHistoryItemResponse,
  AiJobFeedbackDisposition,
  AiJobFeedbackResponse,
  AiUsageResponse,
  RewriteAiStreamRequest,
  SummarizeAiStreamRequest,
  TextSelection,
  TranslateAiStreamRequest,
} from "../types/api";
import type { ApiClient } from "./api";

export interface AiSelectionSnapshot {
  selection: TextSelection;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  baseVersionId: string;
}

export interface AiStreamRequest extends AiSelectionSnapshot {
  documentId: string;
  action: AiAction;
  instruction?: string;
  targetLanguage?: string;
}

export interface AiStreamChunk {
  type: "token" | "done" | "error";
  text?: string;
  jobId?: string | null;
  errorMessage?: string;
}

export interface AiStreamSession {
  jobId: string | null;
  stream: AsyncIterable<AiStreamChunk>;
  cancel(): void;
}

export interface AiHistoryItem {
  id: string;
  documentId: string;
  action: AiAction;
  promptLabel: string;
  outputPreview: string;
  status: AiHistoryItemResponse["status"];
  createdAt: string;
  jobId: string;
}

export interface AiService {
  startStream(request: AiStreamRequest): Promise<AiStreamSession>;
  listHistory(documentId: string): Promise<AiHistoryItem[]>;
  getUsage(documentId: string): Promise<AiUsageResponse>;
  recordFeedback(
    jobId: string,
    disposition: AiJobFeedbackDisposition,
    feedback?: { appliedText?: string; appliedRange?: TextSelection; documentId?: string; action?: AiHistoryItem["action"]; edited?: boolean }
  ): Promise<AiJobFeedbackResponse>;
}

function toHistoryItem(item: AiHistoryItemResponse): AiHistoryItem {
  return item;
}

function parseSseEvent(block: string): { event: string; data: Record<string, unknown> } | null {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!eventLine || !dataLine) {
    return null;
  }

  try {
    return {
      event: eventLine.slice("event:".length).trim(),
      data: JSON.parse(dataLine.slice("data:".length).trim()) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

function mapStreamPayload(request: AiStreamRequest): RewriteAiStreamRequest | SummarizeAiStreamRequest | TranslateAiStreamRequest {
  if (request.action === "translate") {
    return {
      documentId: request.documentId,
      selection: request.selection,
      selectedText: request.selectedText,
      contextBefore: request.contextBefore,
      contextAfter: request.contextAfter,
      targetLanguage: request.targetLanguage || "English",
      instruction: request.instruction,
      baseVersionId: request.baseVersionId,
    };
  }

  if (request.action === "summarize") {
    return {
      documentId: request.documentId,
      selection: request.selection,
      selectedText: request.selectedText,
      contextBefore: request.contextBefore,
      contextAfter: request.contextAfter,
      instruction: request.instruction,
      baseVersionId: request.baseVersionId,
    };
  }

  return {
    documentId: request.documentId,
    selection: request.selection,
    selectedText: request.selectedText,
    contextBefore: request.contextBefore,
    contextAfter: request.contextAfter,
    instruction: request.instruction || "Rewrite this selection",
    baseVersionId: request.baseVersionId,
  };
}

export function createAiService(apiClient: ApiClient): AiService {
  return {
    async startStream(request) {
      const controller = new AbortController();
      let currentJobId: string | null = null;
      const response = await apiClient.startAiStream(request.action, mapStreamPayload(request), controller.signal);

      const stream = (async function* (): AsyncIterable<AiStreamChunk> {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Streaming response body is unavailable.");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            const parsed = parseSseEvent(block);
            if (!parsed) {
              continue;
            }

            const nextJobId: string | null = typeof parsed.data.jobId === "string" ? parsed.data.jobId : currentJobId;
            if (nextJobId) {
              currentJobId = nextJobId;
            }

            if (parsed.event === "token") {
              yield {
                type: "token",
                jobId: nextJobId,
                text: typeof parsed.data.text === "string" ? parsed.data.text : "",
              };
              continue;
            }

            if (parsed.event === "done") {
              yield {
                type: "done",
                jobId: nextJobId,
                text: typeof parsed.data.fullText === "string" ? parsed.data.fullText : "",
              };
              continue;
            }

            if (parsed.event === "error") {
              yield {
                type: "error",
                jobId: nextJobId,
                errorMessage:
                  typeof parsed.data.message === "string"
                    ? parsed.data.message
                    : "AI generation failed.",
              };
            }
          }
        }
      })();

      return {
        jobId: null,
        stream,
        cancel() {
          controller.abort();
          if (currentJobId) {
            void apiClient.cancelAiJob(currentJobId);
          }
        },
      };
    },

    async listHistory(documentId) {
      const items = await apiClient.listAiHistory(documentId);
      return items.map(toHistoryItem);
    },

    getUsage(documentId) {
      return apiClient.getAiUsage(documentId);
    },

    async recordFeedback(jobId, disposition, feedback) {
      return apiClient.recordAiJobFeedback(jobId, {
        disposition,
        appliedText: feedback?.appliedText,
        appliedRange: feedback?.appliedRange,
      });
    },
  };
}
