import type {
  AiJobFeedbackDisposition,
  AiJobFeedbackResponse,
  AiJobResponse,
  TextSelection,
} from "../types/api";
import type { ApiClient } from "./api";

export type AiJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface PollJobOptions {
  userId?: string;
  onStatusChange?(job: AiJobResponse): void;
}

export interface AiSelectionSnapshot {
  selection: TextSelection;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  baseVersionId: string;
}

export interface AiStreamRequest extends AiSelectionSnapshot {
  documentId: string;
  action: "rewrite" | "summarize" | "translate";
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
  action: "rewrite" | "summarize" | "translate";
  promptLabel: string;
  outputPreview: string;
  status: "completed" | "accepted" | "edited" | "rejected";
  createdAt: string;
  jobId: string | null;
}

export interface AiService {
  requestRewrite(
    documentId: string,
    snapshot: AiSelectionSnapshot,
    instruction?: string
  ): Promise<AiJobResponse>;
  requestSummarize(documentId: string, snapshot: AiSelectionSnapshot): Promise<AiJobResponse>;
  requestTranslate(
    documentId: string,
    snapshot: AiSelectionSnapshot,
    targetLanguage: string
  ): Promise<AiJobResponse>;
  pollJobUntilDone(jobId: string, options?: PollJobOptions): Promise<AiJobResponse>;
  startStream(request: AiStreamRequest): Promise<AiStreamSession>;
  listHistory(documentId: string): Promise<AiHistoryItem[]>;
  recordFeedback(
    jobId: string,
    disposition: AiJobFeedbackDisposition,
    feedback?: { appliedText?: string; appliedRange?: TextSelection; documentId?: string; action?: AiHistoryItem["action"]; edited?: boolean }
  ): Promise<AiJobFeedbackResponse>;
}

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20;
const AI_HISTORY_STORAGE_KEY = "collaborative-editor-ai.ai-history";

function hasWindowStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAiHistory(): AiHistoryItem[] {
  if (!hasWindowStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(AI_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiHistoryItem[]) : [];
  } catch (error) {
    console.warn("[ai-service] failed_to_read_history", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function writeAiHistory(items: AiHistoryItem[]) {
  if (!hasWindowStorage()) {
    return;
  }

  window.localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(items));
}

function upsertAiHistory(item: AiHistoryItem) {
  const nextItems = readAiHistory().filter((existing) => existing.id !== item.id);
  nextItems.unshift(item);
  writeAiHistory(nextItems);
}

function updateAiHistoryByJobId(jobId: string, update: Partial<AiHistoryItem>) {
  const nextItems = readAiHistory().map((item) => {
    if (item.jobId !== jobId) {
      return item;
    }

    return {
      ...item,
      ...update,
    };
  });
  writeAiHistory(nextItems);
}

function buildPromptLabel(request: AiStreamRequest): string {
  if (request.action === "translate") {
    return `Translate to ${request.targetLanguage || "target language"}`;
  }

  if (request.action === "summarize") {
    return "Summarize selection";
  }

  return request.instruction || "Rewrite selection";
}

function createHistoryItem(request: AiStreamRequest, jobId: string | null): AiHistoryItem {
  return {
    id: `${request.documentId}:${jobId || Date.now()}`,
    documentId: request.documentId,
    action: request.action,
    promptLabel: buildPromptLabel(request),
    outputPreview: "",
    status: "completed",
    createdAt: new Date().toISOString(),
    jobId,
  };
}

function chunkTextForStreaming(value: string): string[] {
  if (!value) {
    return [];
  }

  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += 4) {
    chunks.push(value.slice(index, index + 4));
  }
  return chunks;
}

export function createAiService(apiClient: ApiClient, userId?: string): AiService {
  function makeRequestId(prefix: string): string {
    return `req_${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  async function pollJobUntilDone(jobId: string, options: PollJobOptions = {}): Promise<AiJobResponse> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      const job = await apiClient.getAiJobStatus(jobId, options.userId ?? userId);
      options.onStatusChange?.(job);

      if (job.status === "SUCCEEDED" || job.status === "FAILED") {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    return {
      jobId,
      statusUrl: "",
      status: "FAILED",
      errorMessage: "AI_TIMEOUT: job did not complete in time",
    };
  }

  async function createJobForRequest(request: AiStreamRequest): Promise<AiJobResponse> {
    if (request.action === "rewrite") {
      return apiClient.requestRewriteJob(
        {
          documentId: request.documentId,
          selection: request.selection,
          selectedText: request.selectedText,
          contextBefore: request.contextBefore,
          contextAfter: request.contextAfter,
          instruction: request.instruction || "Rewrite this selection",
          baseVersionId: request.baseVersionId,
          requestId: makeRequestId("ai_rewrite"),
        },
        userId
      );
    }

    if (request.action === "summarize") {
      return apiClient.requestSummarizeJob(
        {
          documentId: request.documentId,
          selection: request.selection,
          selectedText: request.selectedText,
          contextBefore: request.contextBefore,
          contextAfter: request.contextAfter,
          baseVersionId: request.baseVersionId,
          requestId: makeRequestId("ai_summarize"),
        },
        userId
      );
    }

    return apiClient.requestTranslateJob(
      {
        documentId: request.documentId,
        selection: request.selection,
        selectedText: request.selectedText,
        contextBefore: request.contextBefore,
        contextAfter: request.contextAfter,
        targetLanguage: request.targetLanguage || "English",
        baseVersionId: request.baseVersionId,
        requestId: makeRequestId("ai_translate"),
      },
      userId
    );
  }

  return {
    requestRewrite: (documentId, snapshot, instruction = "Rewrite this selection") =>
      apiClient.requestRewriteJob(
        {
          documentId,
          ...snapshot,
          instruction,
          requestId: makeRequestId("ai_rewrite"),
        },
        userId
      ),
    requestSummarize: (documentId, snapshot) =>
      apiClient.requestSummarizeJob(
        {
          documentId,
          ...snapshot,
          requestId: makeRequestId("ai_summarize"),
        },
        userId
      ),
    requestTranslate: (documentId, snapshot, targetLanguage) =>
      apiClient.requestTranslateJob(
        {
          documentId,
          ...snapshot,
          targetLanguage,
          requestId: makeRequestId("ai_translate"),
        },
        userId
      ),
    pollJobUntilDone,

    async startStream(request) {
      console.info("[ai-service] start_stream", {
        documentId: request.documentId,
        action: request.action,
      });

      let cancelled = false;
      const initialJob = await createJobForRequest(request);
      const historyItem = createHistoryItem(request, initialJob.jobId);
      upsertAiHistory(historyItem);

      const stream = (async function* (): AsyncIterable<AiStreamChunk> {
        const completedJob =
          initialJob.status === "SUCCEEDED" ? initialJob : await pollJobUntilDone(initialJob.jobId, { userId });

        if (cancelled) {
          return;
        }

        if (completedJob.status === "FAILED") {
          updateAiHistoryByJobId(initialJob.jobId, {
            status: "rejected",
            outputPreview: completedJob.errorMessage || "",
          });
          yield {
            type: "error",
            jobId: initialJob.jobId,
            errorMessage: completedJob.errorMessage || "AI generation failed.",
          };
          return;
        }

        const fullText = completedJob.output || completedJob.proposedText || "";
        updateAiHistoryByJobId(initialJob.jobId, {
          outputPreview: fullText,
          status: "completed",
        });

        for (const chunk of chunkTextForStreaming(fullText)) {
          if (cancelled) {
            return;
          }

          yield {
            type: "token",
            text: chunk,
            jobId: initialJob.jobId,
          };
          await Promise.resolve();
        }

        if (!cancelled) {
          yield {
            type: "done",
            jobId: initialJob.jobId,
            text: fullText,
          };
        }
      })();

      return {
        jobId: initialJob.jobId,
        stream,
        cancel() {
          console.info("[ai-service] cancel_stream", {
            jobId: initialJob.jobId,
          });
          cancelled = true;
        },
      };
    },

    async listHistory(documentId) {
      return readAiHistory().filter((item) => item.documentId === documentId);
    },

    async recordFeedback(jobId, disposition, feedback) {
      const response = await apiClient.recordAiJobFeedback(
        jobId,
        {
          disposition,
          appliedText: feedback?.appliedText,
          appliedRange: feedback?.appliedRange,
        },
        userId
      );

      updateAiHistoryByJobId(jobId, {
        status:
          disposition === "rejected"
            ? "rejected"
            : feedback?.edited
              ? "edited"
              : "accepted",
        outputPreview: feedback?.appliedText,
      });

      return response;
    },
  };
}
