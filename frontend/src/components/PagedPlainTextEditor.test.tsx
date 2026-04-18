import { fireEvent, render, screen } from "@testing-library/react";

import { PagedPlainTextEditor } from "./PagedPlainTextEditor";
import { renderRichTextPreview } from "../lib/richTextPreview";

describe("PagedPlainTextEditor", () => {
  it("renders plain-text formatting markers as styled preview spans while preserving source text", () => {
    const source = "start **bold** *lean* <u>line</u> ~~gone~~ end";

    render(<div data-testid="preview-root">{renderRichTextPreview(source)}</div>);

    const preview = screen.getByTestId("preview-root");
    expect(preview.textContent).toBe(source);
    expect(preview.querySelector(".gdoc-inline-bold")?.textContent).toBe("bold");
    expect(preview.querySelector(".gdoc-inline-italic")?.textContent).toBe("lean");
    expect(preview.querySelector(".gdoc-inline-underline")?.textContent).toBe("line");
    expect(preview.querySelector(".gdoc-inline-strike")?.textContent).toBe("gone");
    expect(preview.querySelectorAll(".gdoc-marker-hidden")).toHaveLength(8);
  });

  it("waits for IME composition to finish before emitting editor changes", () => {
    const handleChange = vi.fn();
    const handleSelectionChange = vi.fn();

    render(
      <PagedPlainTextEditor
        value="ni"
        onChange={handleChange}
        onSelectionChange={handleSelectionChange}
      />
    );

    const editor = screen.getByRole("textbox", { name: "Document content page 1" });
    editor.textContent = "你";

    fireEvent.compositionStart(editor);
    fireEvent.input(editor);
    expect(handleChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(editor, { data: "你" });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("你");
  });
});
