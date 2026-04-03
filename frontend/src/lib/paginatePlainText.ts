export interface PaginationPage {
  index: number;
  start: number;
  end: number;
  text: string;
}

export interface PaginationConfig {
  maxLineWidthPx: number;
  maxLinesPerPage: number;
  measureTextWidth(text: string): number;
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char) && char !== "\n";
}

function findLastBreakOpportunity(value: string, start: number, end: number): number {
  for (let index = end; index >= start; index -= 1) {
    if (isWhitespace(value[index] ?? "")) {
      return index;
    }
  }

  return -1;
}

/**
 * Split a plain-text document into fixed-height pages by simulating soft wraps.
 * Keeping this logic pure makes the pagination testable without depending on
 * browser layout APIs, which keeps regressions visible in CI.
 */
export function paginatePlainText(value: string, config: PaginationConfig): PaginationPage[] {
  if (value.length === 0) {
    return [{ index: 0, start: 0, end: 0, text: "" }];
  }

  const lineStarts = [0];
  let lineStart = 0;
  let currentLineWidth = 0;
  let lastBreakOpportunity = -1;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === "\n") {
      const nextLineStart = index + 1;
      if (nextLineStart < value.length) {
        lineStarts.push(nextLineStart);
      }
      lineStart = nextLineStart;
      currentLineWidth = 0;
      lastBreakOpportunity = -1;
      continue;
    }

    currentLineWidth += config.measureTextWidth(char);
    if (isWhitespace(char)) {
      lastBreakOpportunity = index;
    }

    if (currentLineWidth <= config.maxLineWidthPx) {
      continue;
    }

    let nextLineStart = lastBreakOpportunity >= lineStart ? lastBreakOpportunity + 1 : index;
    if (nextLineStart <= lineStart) {
      nextLineStart = index;
    }

    if (nextLineStart < value.length) {
      lineStarts.push(nextLineStart);
    }

    lineStart = nextLineStart;
    currentLineWidth = config.measureTextWidth(value.slice(lineStart, index + 1));
    lastBreakOpportunity = findLastBreakOpportunity(value, lineStart, index);
  }

  const pages: PaginationPage[] = [];
  for (let index = 0; index < lineStarts.length; index += config.maxLinesPerPage) {
    const start = lineStarts[index];
    const end = lineStarts[index + config.maxLinesPerPage] ?? value.length;
    pages.push({
      index: pages.length,
      start,
      end,
      text: value.slice(start, end),
    });
  }

  return pages;
}
