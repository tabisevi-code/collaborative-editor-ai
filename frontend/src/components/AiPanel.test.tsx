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
    getUsage: vi.fn(async () => ({
      documentId: "doc_123",
      aiEnabled: true,
      dailyQuota: 5,
      usedToday: 1,
      remainingToday: 4,
      allowedRolesForAI: ["owner", "editor"],
      currentUserRole: "owner",
      canUseAi: true,
    })),
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
    expect(screen.getByText(/1\/5 used today/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rewrite instruction/i)).toHaveValue("Make this clearer and more concise.");

    fireEvent.click(screen.getByTestId("ai-run"));

    await screen.findByText(/suggestion ready/i);
    expect(screen.getByDisplayValue("Improved sentence")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/apply all/i));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith({
        text: "Improved sentence",
        mode: "full",
        jobId: "aijob_123",
        targetSelection: { start: 0, end: 5 },
        sourceText: "Hello",
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

    fireEvent.click(screen.getByTestId("ai-run"));
    await screen.findByRole("button", { name: /cancel stream/i });
    fireEvent.click(screen.getByRole("button", { name: /cancel stream/i }));

    expect(cancel).toHaveBeenCalledTimes(1);
    await screen.findByText(/generation cancelled/i);
  });

  it("shows translation-specific controls", async () => {
    const aiService = createAiServiceMock();

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

    expect(await screen.findByText(/1\/5 used today/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ai-action-translate"));

    expect(screen.getByTestId("ai-target-language")).toBeInTheDocument();
    expect(screen.getByLabelText(/translation notes/i)).toBeInTheDocument();
  });

  it("applies a completed suggestion back to the selection that generated it", async () => {
    const aiService = createAiServiceMock();
    const onApply = vi.fn();
    const { rerender } = render(
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
        onUseWholeDocument={vi.fn()}
        onApply={onApply}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("ai-run"));
    await screen.findByText(/suggestion ready/i);

    rerender(
      <AiPanel
        documentId="doc_123"
        snapshot={{
          selection: { start: 6, end: 11 },
          selectedText: "world",
          contextBefore: "Hello ",
          contextAfter: "",
          baseVersionId: "ver_1",
        }}
        selectedText="world"
        aiService={aiService}
        onUseWholeDocument={vi.fn()}
        onApply={onApply}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("ai-apply-all"));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Improved sentence",
          targetSelection: { start: 0, end: 5 },
          sourceText: "Hello",
        })
      );
    });
  });

  it("surfaces a stale-source error instead of closing when apply fails", async () => {
    const aiService = createAiServiceMock();
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
        onApply={vi.fn(async () => {
          throw new Error("The selected text changed before the AI result was applied. Re-run AI on the latest text.");
        })}
        onReject={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId("ai-run"));
    await screen.findByText(/suggestion ready/i);
    fireEvent.click(screen.getByTestId("ai-apply-all"));

    await waitFor(() => {
      expect(screen.getByText(/selected text changed before the ai result was applied/i)).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
