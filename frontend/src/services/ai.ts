import type { AiAction, AiJobResponse } from "../types/api";
import type { ApiClient } from "./api";

export type AiJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface AiService {
  requestRewrite(documentId: string, text: string): Promise<AiJobResponse>;
  requestSummarize(documentId: string, text: string): Promise<AiJobResponse>;
  requestTranslate(documentId: string, text: string, targetLanguage: string): Promise<AiJobResponse>;
  pollJobUntilDone(jobId: string, userId?: string): Promise<AiJobResponse>;
}

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20;

export function createAiService(apiClient: ApiClient, userId?: string): AiService {
  async function requestJob(
    documentId: string,
    action: AiAction,
    text: string,
    targetLanguage?: string
  ): Promise<AiJobResponse> {
    return apiClient.requestAiJob({ documentId, action, text, targetLanguage }, userId);
  }

  async function pollJobUntilDone(jobId: string, pollUserId?: string): Promise<AiJobResponse> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const job = await apiClient.getAiJobStatus(jobId, pollUserId ?? userId);

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

  return {
    requestRewrite: (documentId, text) => requestJob(documentId, "rewrite", text),
    requestSummarize: (documentId, text) => requestJob(documentId, "summarize", text),
    requestTranslate: (documentId, text, targetLanguage) =>
      requestJob(documentId, "translate", text, targetLanguage),
    pollJobUntilDone,
  };
}
