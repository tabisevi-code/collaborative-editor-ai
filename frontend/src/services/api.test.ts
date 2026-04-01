import { createApiClient } from "./api";
import { ApiError } from "../types/api";

describe("api client", () => {
  it("logs in and sends Authorization on createDocument requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) {
        return new Response(
          JSON.stringify({
            userId: "user_1",
            accessToken: "token_user_1",
          }),
          { status: 200 }
        );
      }

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

    await client.createDocument({ title: "Test Doc", content: "Hello" }, "user_1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, options] = fetchMock.mock.calls[1] as [string, RequestInit];
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
      if (url.endsWith("/auth/login")) {
        return new Response(JSON.stringify({ userId: "user_export", accessToken: "token_export" }), { status: 200 });
      }

      if (url.endsWith("/documents/doc_123/export")) {
        return new Response(JSON.stringify({ jobId: "expjob_123", statusUrl: "/exports/expjob_123" }), {
          status: 202,
        });
      }

      if (url.endsWith("/sessions")) {
        return new Response(
          JSON.stringify({
            sessionId: "sess_123",
            wsUrl: "ws://localhost:3001/ws?token=abc",
            role: "editor",
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = createApiClient("http://localhost:3000", fetchMock as typeof fetch);

    await expect(client.createExport("doc_123", { format: "pdf" }, "user_export")).resolves.toMatchObject({
      jobId: "expjob_123",
      statusUrl: "/exports/expjob_123",
    });

    await expect(client.createSession("doc_123", "user_export")).resolves.toMatchObject({
      sessionId: "sess_123",
      role: "editor",
    });
  });
});
