import { applyToolbarAction } from "./richTextToolbar";

describe("richTextToolbar", () => {
  it("expands a partially selected formatted block before wrapping it again", () => {
    const result = applyToolbarAction("<u>adfhs</u>", { start: 0, end: 8 }, "strike");

    expect(result.value).toBe("~~<u>adfhs</u>~~");
    expect(result.selection).toEqual({ start: 2, end: 14 });
  });

  it("keeps nested formatting valid when only the visible text is selected", () => {
    const result = applyToolbarAction("<u>adfhs</u>", { start: 3, end: 8 }, "strike");

    expect(result.value).toBe("<u>~~adfhs~~</u>");
    expect(result.selection).toEqual({ start: 5, end: 10 });
  });

  it("repairs partial close-marker selections before applying a new format", () => {
    const result = applyToolbarAction("<u>adfhs</u>", { start: 3, end: 12 }, "bold");

    expect(result.value).toBe("**<u>adfhs</u>**");
    expect(result.selection).toEqual({ start: 2, end: 14 });
  });
});
