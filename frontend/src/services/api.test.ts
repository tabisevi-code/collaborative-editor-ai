import { createApiClient } from "./api";
import { ApiError } from "../types/api";

describe("api client", () => {
  it("sends Authorization on createDocument requests after a session is set", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          documentId: "doc_123",
          title: "Test Doc",
          ownerId: "user_1",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
          currentVersionId: "ver_1",
        }),
        { status: 201 }
      );
    });

    const client = createApiClient("http://localhost:3000", fetchMock as typeof fetch);
    client.setSession({ accessToken: "token_user_1" });

    await client.createDocument({ title: "Test Doc", content: "Hello" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token_user_1");
  });

  it("parses successful getDocument responses", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          documentId: "doc_123",
          title: "Loaded Doc",
          content: "Stored body",
          updatedAt: "2026-04-02T00:00:00.000Z",
          currentVersionId: "ver_1",
          role: "owner",
          revisionId: "rev_1",
        }),
        { status: 200 }
      );
    });

    const client = createApiClient("http://localhost:3000", fetchMock as typeof fetch);

    await expect(client.getDocument("doc_123")).resolves.toMatchObject({
      documentId: "doc_123",
      title: "Loaded Doc",
      role: "owner",
    });
  });

  it("converts backend error payloads into ApiError objects", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_INPUT",
            message: "title is required",
          },
        }),
        { status: 400 }
      );
    });

    const client = createApiClient("http://localhost:3000", fetchMock as typeof fetch);

    await expect(client.createDocument({ title: "", content: "" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
      message: "title is required",
    } satisfies Partial<ApiError>);
  });

  it("parses export job responses and session issuance responses", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/documents/doc_123/export")) {
        return new Response(JSON.stringify({ jobId: "expjob_123", statusUrl: "/exports/expjob_123" }), {
          status: 200,
        });
      }

      if (url.endsWith("/sessions")) {
        return new Response(
          JSON.stringify({
            sessionId: "sess_123",
            wsUrl: "ws://localhost:3001/ws",
            sessionToken: "abc",
            role: "editor",
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = createApiClient("http://localhost:3000", fetchMock as typeof fetch);
    client.setSession({ accessToken: "token_export" });

    await expect(client.createExport("doc_123", { format: "pdf" })).resolves.toMatchObject({
      jobId: "expjob_123",
      statusUrl: "/exports/expjob_123",
    });

    await expect(client.createSession("doc_123")).resolves.toMatchObject({
      sessionId: "sess_123",
      sessionToken: "abc",
      role: "editor",
    });
  });

  it("starts AI streams and exposes history, usage, and cancel endpoints", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) {
        return new Response(JSON.stringify({ userId: "user_ai", accessToken: "token_ai" }), { status: 200 });
      }

      if (url.endsWith("/ai/rewrite/stream")) {
        return new Response('event: token\ndata: {"jobId":"aijob_123","text":"Hello"}\n\n', {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
        });
      }

      if (url.endsWith("/documents/doc_123/ai-history")) {
        return new Response(
          JSON.stringify([
            {
              id: "aih_1",
              documentId: "doc_123",
              action: "rewrite",
              promptLabel: "Rewrite selection",
              outputPreview: "Hello",
              status: "completed",
              createdAt: "2026-04-02T00:00:00.000Z",
              jobId: "aijob_123",
            },
          ]),
          { status: 200 }
        );
      }

      if (url.endsWith("/documents/doc_123/ai-usage")) {
        return new Response(
          JSON.stringify({
            documentId: "doc_123",
            aiEnabled: true,
            dailyQuota: 5,
            usedToday: 1,
            remainingToday: 4,
            allowedRolesForAI: ["owner", "editor"],
            currentUserRole: "owner",
            canUseAi: true,
            updatedAt: "2026-04-02T00:00:00.000Z",
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/ai/jobs/aijob_123/cancel")) {
        return new Response(JSON.stringify({ jobId: "aijob_123", cancelled: true }), { status: 200 });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = createApiClient("http://localhost:3000", fetchMock as typeof fetch);
    const streamResponse = await client.startAiStream(
      "rewrite",
      {
        documentId: "doc_123",
        selection: { start: 0, end: 5 },
        selectedText: "Hello",
        contextBefore: "",
        contextAfter: " world",
        instruction: "Make this clearer",
        baseVersionId: "ver_1",
      },
      undefined,
      "user_ai"
    );

    expect(streamResponse.ok).toBe(true);
    await expect(client.listAiHistory("doc_123", "user_ai")).resolves.toHaveLength(1);
    await expect(client.getAiUsage("doc_123", "user_ai")).resolves.toMatchObject({
      usedToday: 1,
      remainingToday: 4,
    });
    await expect(client.cancelAiJob("aijob_123", "user_ai")).resolves.toEqual({
      jobId: "aijob_123",
      cancelled: true,
    });

    const [, requestOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    const headers = requestOptions.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token_ai");
    expect(headers.get("Accept")).toBe("text/event-stream");
  });
});
