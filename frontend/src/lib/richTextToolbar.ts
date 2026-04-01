export interface ToolbarSelection {
  start: number;
  end: number;
}

export interface ToolbarEditResult {
  value: string;
  selection: ToolbarSelection;
}

export type InlineFormat = "bold" | "italic" | "underline" | "strike";
export type ToolbarAction =
  | InlineFormat
  | "bulletList"
  | "numberedList"
  | "undo"
  | "redo";

const INLINE_MARKERS: Record<InlineFormat, { prefix: string; suffix: string }> = {
  bold: { prefix: "**", suffix: "**" },
  italic: { prefix: "*", suffix: "*" },
  underline: { prefix: "<u>", suffix: "</u>" },
  strike: { prefix: "~~", suffix: "~~" },
};

/**
 * The backend currently persists plain text only, so toolbar formatting needs
 * to express intent with text markers instead of browser-only rich text state.
 * This keeps save/realtime flows stable while making the toolbar genuinely usable.
 */
export function applyToolbarAction(
  value: string,
  selection: ToolbarSelection,
  action: Exclude<ToolbarAction, "undo" | "redo">
): ToolbarEditResult {
  if (action === "bulletList") {
    return toggleLinePrefix(value, selection, "- ");
  }

  if (action === "numberedList") {
    return toggleNumberedList(value, selection);
  }

  return toggleInlineFormat(value, selection, action);
}

/**
 * Wrap the selected text with the chosen markers, or remove them when the same
 * formatting is already present. For an empty selection we insert the markers
 * and place the caret between them so typing can continue naturally.
 */
function toggleInlineFormat(
  value: string,
  selection: ToolbarSelection,
  format: InlineFormat
): ToolbarEditResult {
  const { prefix, suffix } = INLINE_MARKERS[format];
  const before = value.slice(0, selection.start);
  const selected = value.slice(selection.start, selection.end);
  const after = value.slice(selection.end);

  const alreadyWrapped =
    selection.start >= prefix.length &&
    value.slice(selection.start - prefix.length, selection.start) === prefix &&
    value.slice(selection.end, selection.end + suffix.length) === suffix;

  if (alreadyWrapped) {
    const nextValue =
      value.slice(0, selection.start - prefix.length) +
      selected +
      value.slice(selection.end + suffix.length);

    return {
      value: nextValue,
      selection: {
        start: selection.start - prefix.length,
        end: selection.end - prefix.length,
      },
    };
  }

  const nextValue = before + prefix + selected + suffix + after;
  const caretOffset = prefix.length;

  return {
    value: nextValue,
    selection:
      selection.start === selection.end
        ? {
            start: selection.start + caretOffset,
            end: selection.end + caretOffset,
          }
        : {
            start: selection.start + caretOffset,
            end: selection.end + caretOffset,
          },
  };
}

/**
 * Prefix or unprefix every line in the current block selection. Keeping the
 * operation line-oriented avoids surprising partial edits inside a paragraph.
 */
function toggleLinePrefix(value: string, selection: ToolbarSelection, prefix: string): ToolbarEditResult {
  const range = getSelectedLines(value, selection);
  const lines = range.text.split("\n");
  const shouldRemove = lines.every((line) => line.startsWith(prefix) || line.trim() === "");
  const nextLines = lines.map((line) => {
    if (line.trim() === "") {
      return line;
    }

    return shouldRemove ? line.slice(prefix.length) : `${prefix}${line}`;
  });
  const nextText = nextLines.join("\n");
  const nextValue = value.slice(0, range.start) + nextText + value.slice(range.end);

  return {
    value: nextValue,
    selection: {
      start: range.start,
      end: range.start + nextText.length,
    },
  };
}

function toggleNumberedList(value: string, selection: ToolbarSelection): ToolbarEditResult {
  const range = getSelectedLines(value, selection);
  const lines = range.text.split("\n");
  const shouldRemove = lines.every((line, index) => {
    if (line.trim() === "") {
      return true;
    }

    return line.startsWith(`${index + 1}. `);
  });

  const nextLines = lines.map((line, index) => {
    if (line.trim() === "") {
      return line;
    }

    const prefix = `${index + 1}. `;
    return shouldRemove ? line.slice(prefix.length) : `${prefix}${line}`;
  });

  const nextText = nextLines.join("\n");
  const nextValue = value.slice(0, range.start) + nextText + value.slice(range.end);

  return {
    value: nextValue,
    selection: {
      start: range.start,
      end: range.start + nextText.length,
    },
  };
}

function getSelectedLines(value: string, selection: ToolbarSelection) {
  const start = value.lastIndexOf("\n", Math.max(0, selection.start - 1)) + 1;
  const nextNewline = value.indexOf("\n", selection.end);
  const end = nextNewline === -1 ? value.length : nextNewline;

  return {
    start,
    end,
    text: value.slice(start, end),
  };
}
