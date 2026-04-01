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
  };
}

describe("AiPanel", () => {
  it("shows job progress and a before/after review before applying", async () => {
    const aiService = createAiServiceMock();
    const onApply = vi.fn();
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
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText(/run ai/i));

    await screen.findByText(/suggestion ready/i);
    await screen.findByText(/after/i);
    expect(screen.getByText("Improved sentence")).toBeInTheDocument();
    expect(screen.getAllByText(/^Hello$/)).toHaveLength(2);

    fireEvent.click(screen.getByText(/apply suggestion/i));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith("Improved sentence");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
