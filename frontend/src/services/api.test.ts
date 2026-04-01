import { createApiClient } from "./api";
import { ApiError } from "../types/api";

describe("api client", () => {
  it("sends x-user-id on createDocument requests", async () => {
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

    await client.createDocument({ title: "Test Doc", content: "Hello" }, "user_1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("x-user-id")).toBe("user_1");
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

    await expect(client.getDocument("doc_123", "user_1")).resolves.toMatchObject({
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

    await expect(client.createDocument({ title: "", content: "" }, "user_1")).rejects.toMatchObject({
      status: 400,
      code: "INVALID_INPUT",
      message: "title is required",
    } satisfies Partial<ApiError>);
  });
});
