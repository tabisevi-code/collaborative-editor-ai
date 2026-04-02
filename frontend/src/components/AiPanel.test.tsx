import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { AiService } from "../services/ai";
import { AiPanel } from "./AiPanel";

function createAiServiceMock(): AiService {
  return {
    requestRewrite: vi.fn(async () => ({
      jobId: "aijob_123",
      statusUrl: "/ai/jobs/aijob_123",
      status: "PENDING",
    })),
    requestSummarize: vi.fn(),
    requestTranslate: vi.fn(),
    pollJobUntilDone: vi.fn(async (_jobId, options) => {
      options?.onStatusChange?.({
        jobId: "aijob_123",
        statusUrl: "/ai/jobs/aijob_123",
        status: "RUNNING",
      });

      return {
        jobId: "aijob_123",
        statusUrl: "/ai/jobs/aijob_123",
        status: "SUCCEEDED",
        proposedText: "Improved sentence",
      };
    }),
    recordFeedback: vi.fn(async () => ({
      jobId: "aijob_123",
      disposition: "rejected",
      recordedAt: "2026-04-02T00:00:00.000Z",
    })),
  };
}

describe("AiPanel", () => {
  it("shows job progress and a before/after review before applying", async () => {
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

    fireEvent.click(screen.getByText(/run ai/i));

    await screen.findByText(/suggestion ready/i);
    await screen.findByText(/after/i);
    expect(screen.getByDisplayValue("Improved sentence")).toBeInTheDocument();
    expect(screen.getAllByText(/^Hello$/)).toHaveLength(2);

    fireEvent.click(screen.getByText(/apply all/i));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith({
        text: "Improved sentence",
        mode: "full",
        jobId: "aijob_123",
        targetSelection: { start: 0, end: 5 },
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("applies only the highlighted part of the AI suggestion when requested", async () => {
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

    fireEvent.click(screen.getByText(/run ai/i));
    const suggestionInput = await screen.findByDisplayValue("Improved sentence");
    suggestionInput.setSelectionRange(0, 8);
    fireEvent.select(suggestionInput);

    fireEvent.click(screen.getByRole("button", { name: /^Apply selection$/i }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith({
        text: "Improved",
        mode: "partial",
        jobId: "aijob_123",
        targetSelection: { start: 0, end: 5 },
      });
    });
  });
});
