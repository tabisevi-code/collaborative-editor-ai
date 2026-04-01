/**
 * The PoC does not execute AI requests yet, but these shared types establish
 * the job lifecycle the frontend will eventually render.
 */
export type AiJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface AiJobResult {
  jobId: string;
  status: AiJobStatus;
  output?: string;
  errorMessage?: string;
}

export interface AiService {
  requestRewrite(documentId: string, selectedText: string): Promise<AiJobResult>;
  getJobStatus(jobId: string): Promise<AiJobResult>;
}

// TODO: Implement the real async AI job service when backend endpoints exist.
