import { createRef } from "react";
import { render } from "@testing-library/react";

import { INITIAL_FORMATTING, RichEditor, type RichEditorHandle } from "./RichEditor";

describe("RichEditor", () => {
  it("restores the last editor selection before running a toolbar format command", () => {
    const execCommand = vi.fn(() => true);
    const selectionState = INITIAL_FORMATTING;
    const queryCommandState = vi.fn(() => false);
    const queryCommandValue = vi.fn(() => "");

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    Object.defineProperty(document, "queryCommandState", {
      configurable: true,
      value: queryCommandState,
    });
    Object.defineProperty(document, "queryCommandValue", {
      configurable: true,
      value: queryCommandValue,
    });

    const ref = createRef<RichEditorHandle>();
    const { getByRole } = render(
      <RichEditor
        ref={ref}
        initialHTML="<p>Hello world</p>"
        onChange={() => {}}
        onSelectionChange={() => selectionState}
      />
    );

    const editor = getByRole("textbox");
    const textNode = editor.querySelector("p")?.firstChild;
    expect(textNode).not.toBeNull();

    const range = document.createRange();
    range.setStart(textNode as Text, 0);
    range.setEnd(textNode as Text, 5);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));

    selection?.removeAllRanges();

    ref.current?.format("bold");

    expect(execCommand).toHaveBeenCalledWith("bold", false, undefined);
    expect(selection?.toString()).toBe("Hello");
  });
});
