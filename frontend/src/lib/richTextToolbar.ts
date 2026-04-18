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
  const normalizedSelection = normalizeInlineSelection(value, selection);
  const { prefix, suffix } = INLINE_MARKERS[format];
  const before = value.slice(0, normalizedSelection.start);
  const selected = value.slice(normalizedSelection.start, normalizedSelection.end);
  const after = value.slice(normalizedSelection.end);

  const alreadyWrapped =
    normalizedSelection.start >= prefix.length &&
    value.slice(normalizedSelection.start - prefix.length, normalizedSelection.start) === prefix &&
    value.slice(normalizedSelection.end, normalizedSelection.end + suffix.length) === suffix;

  if (alreadyWrapped) {
    const nextValue =
      value.slice(0, normalizedSelection.start - prefix.length) +
      selected +
      value.slice(normalizedSelection.end + suffix.length);

    return {
      value: nextValue,
      selection: {
        start: normalizedSelection.start - prefix.length,
        end: normalizedSelection.end - prefix.length,
      },
    };
  }

  const nextValue = before + prefix + selected + suffix + after;
  const caretOffset = prefix.length;

  return {
    value: nextValue,
    selection:
      normalizedSelection.start === normalizedSelection.end
        ? {
            start: normalizedSelection.start + caretOffset,
            end: normalizedSelection.end + caretOffset,
          }
        : {
            start: normalizedSelection.start + caretOffset,
            end: normalizedSelection.end + caretOffset,
          },
  };
}

interface InlineMarkerRange {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
}

/**
 * The paged editor keeps formatting markers in the DOM at zero width so
 * selection math can stay aligned with the stored plain-text document. In
 * practice, repeated mouse selections can still capture only the opening or
 * closing marker of an existing formatted region. If we wrap that raw range as
 * is, we generate overlapping markup like `~~<u>text~~</u>`, which then leaks
 * into the editor. We defensively widen the selection to the full serialized
 * region whenever it clips one side of an existing marker pair.
 */
function normalizeInlineSelection(value: string, selection: ToolbarSelection): ToolbarSelection {
  let normalized = { ...selection };
  let mutated = true;

  while (mutated) {
    mutated = false;

    for (const range of collectInlineMarkerRanges(value)) {
      const includesOpenMarker =
        normalized.start < range.contentStart && normalized.end > range.start;
      const includesCloseMarker =
        normalized.end > range.contentEnd && normalized.start < range.end;

      if (!includesOpenMarker && !includesCloseMarker) {
        continue;
      }

      const nextSelection = {
        start: Math.min(normalized.start, range.start),
        end: Math.max(normalized.end, range.end),
      };

      if (nextSelection.start !== normalized.start || nextSelection.end !== normalized.end) {
        normalized = nextSelection;
        mutated = true;
      }
    }
  }

  return normalized;
}

function collectInlineMarkerRanges(value: string): InlineMarkerRange[] {
  const ranges: InlineMarkerRange[] = [];
  collectInlineMarkerRangesRecursive(value, 0, 0, ranges);
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  return ranges;
}

function collectInlineMarkerRangesRecursive(
  segment: string,
  segmentOffset: number,
  searchStart: number,
  ranges: InlineMarkerRange[]
) {
  let cursor = searchStart;

  while (cursor < segment.length) {
    const nextMatch = findNextMarkerMatch(segment, cursor);
    if (!nextMatch) {
      return;
    }

    const contentStart = segmentOffset + nextMatch.openIndex + nextMatch.openMarker.length;
    const contentEnd = segmentOffset + nextMatch.closeIndex;
    ranges.push({
      start: segmentOffset + nextMatch.openIndex,
      end: segmentOffset + nextMatch.closeIndex + nextMatch.closeMarker.length,
      contentStart,
      contentEnd,
    });

    collectInlineMarkerRangesRecursive(
      segment.slice(nextMatch.openIndex + nextMatch.openMarker.length, nextMatch.closeIndex),
      contentStart,
      0,
      ranges
    );

    cursor = nextMatch.closeIndex + nextMatch.closeMarker.length;
  }
}

interface MarkerMatch {
  openIndex: number;
  closeIndex: number;
  openMarker: string;
  closeMarker: string;
}

function findNextMarkerMatch(value: string, startIndex: number): MarkerMatch | null {
  const candidates = [
    findPairedToken(value, startIndex, "**"),
    findPairedToken(value, startIndex, "~~"),
    findUnderlineToken(value, startIndex),
    findSingleAsteriskToken(value, startIndex),
  ].filter((candidate): candidate is MarkerMatch => candidate !== null);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.openIndex - right.openIndex);
  return candidates[0];
}

function findPairedToken(value: string, startIndex: number, token: string): MarkerMatch | null {
  let openIndex = value.indexOf(token, startIndex);

  while (openIndex !== -1) {
    const closeIndex = value.indexOf(token, openIndex + token.length);
    if (closeIndex !== -1) {
      return {
        openIndex,
        closeIndex,
        openMarker: token,
        closeMarker: token,
      };
    }

    openIndex = value.indexOf(token, openIndex + token.length);
  }

  return null;
}

function findUnderlineToken(value: string, startIndex: number): MarkerMatch | null {
  let openIndex = value.indexOf("<u>", startIndex);

  while (openIndex !== -1) {
    const closeIndex = value.indexOf("</u>", openIndex + 3);
    if (closeIndex !== -1) {
      return {
        openIndex,
        closeIndex,
        openMarker: "<u>",
        closeMarker: "</u>",
      };
    }

    openIndex = value.indexOf("<u>", openIndex + 3);
  }

  return null;
}

function findSingleAsteriskToken(value: string, startIndex: number): MarkerMatch | null {
  let openIndex = findSingleAsterisk(value, startIndex);

  while (openIndex !== -1) {
    const closeIndex = findSingleAsterisk(value, openIndex + 1);
    if (closeIndex !== -1) {
      return {
        openIndex,
        closeIndex,
        openMarker: "*",
        closeMarker: "*",
      };
    }

    openIndex = findSingleAsterisk(value, openIndex + 1);
  }

  return null;
}

function findSingleAsterisk(value: string, startIndex: number): number {
  for (let index = startIndex; index < value.length; index += 1) {
    if (value[index] !== "*") {
      continue;
    }

    if (value[index - 1] === "*" || value[index + 1] === "*") {
      continue;
    }

    return index;
  }

  return -1;
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
