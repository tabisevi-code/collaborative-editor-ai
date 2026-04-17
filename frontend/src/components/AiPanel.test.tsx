import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { AiService } from "../services/ai";
import { AiPanel } from "./AiPanel";

async function* createTokenStream(tokens: string[]) {
  for (const token of tokens) {
    yield {
      type: "token" as const,
      text: token,
      jobId: "aijob_123",
    };
  }

  yield {
    type: "done" as const,
    text: tokens.join(""),
    jobId: "aijob_123",
  };
}

function createAiServiceMock(): AiService {
  return {
    requestRewrite: vi.fn(async () => ({
      jobId: "aijob_123",
      statusUrl: "/ai/jobs/aijob_123",
      status: "PENDING",
    })),
    requestSummarize: vi.fn(),
    requestTranslate: vi.fn(),
    pollJobUntilDone: vi.fn(),
    startStream: vi.fn(async () => ({
      jobId: "aijob_123",
      stream: createTokenStream(["Improved", " sentence"]),
      cancel: vi.fn(),
    })),
    listHistory: vi.fn(async () => [
      {
        id: "hist_1",
        documentId: "doc_123",
        action: "rewrite",
        promptLabel: "Rewrite selection",
        outputPreview: "Older suggestion",
        status: "accepted",
        createdAt: "2026-04-02T00:00:00.000Z",
        jobId: "job_older",
      },
    ]),
    recordFeedback: vi.fn(async () => ({
      jobId: "aijob_123",
      disposition: "rejected",
      recordedAt: "2026-04-02T00:00:00.000Z",
    })),
  };
}

describe("AiPanel", () => {
  it("streams suggestion tokens, shows history, and applies the final text", async () => {
    const aiService = createAiServiceMock();
    const onApply = vi.fn();
    const onReject = vi.fn();
    const onClose = vi.fn();

    render(
      <AiPanel
        documentId="doc_123"
        snapshot={{
          selection: { start: 0, end: 5 },
          selectedText: "Hello",
          contextBefore: "",
          contextAfter: " world",
          baseVersionId: "ver_1",
        }}
        selectedText="Hello"
        aiService={aiService}
        onApply={onApply}
        onReject={onReject}
        onClose={onClose}
      />
    );

    expect(await screen.findByText("Older suggestion")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/run ai/i));

    await screen.findByText(/suggestion ready/i);
    expect(screen.getByDisplayValue("Improved sentence")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/apply all/i));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith({
        text: "Improved sentence",
        mode: "full",
        jobId: "aijob_123",
        targetSelection: { start: 0, end: 5 },
        edited: false,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("cancels an active stream without applying anything", async () => {
    const cancel = vi.fn();
    const aiService = createAiServiceMock();
    (aiService.startStream as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      jobId: "aijob_123",
      stream: (async function* () {
        yield {
          type: "token" as const,
          text: "Improved",
          jobId: "aijob_123",
        };
        await new Promise(() => {});
      })(),
      cancel,
    });

    render(
      <AiPanel
        documentId="doc_123"
        snapshot={{
          selection: { start: 0, end: 5 },
          selectedText: "Hello",
          contextBefore: "",
          contextAfter: " world",
          baseVersionId: "ver_1",
        }}
        selectedText="Hello"
        aiService={aiService}
        onApply={vi.fn()}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/run ai/i));
    await screen.findByRole("button", { name: /cancel stream/i });
    fireEvent.click(screen.getByRole("button", { name: /cancel stream/i }));

    expect(cancel).toHaveBeenCalledTimes(1);
    await screen.findByText(/generation cancelled/i);
  });
});
