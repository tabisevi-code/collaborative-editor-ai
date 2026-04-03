import { Fragment, type ReactNode } from "react";

type PreviewFormat = "bold" | "italic" | "underline" | "strike";

interface MarkerMatch {
  type: PreviewFormat;
  openIndex: number;
  closeIndex: number;
  openMarker: string;
  closeMarker: string;
}

/**
 * The document is still stored as plain text, so the preview layer needs to
 * translate lightweight markers into styled spans without losing the original
 * characters. Hidden marker nodes keep `textContent` identical to the stored
 * source, which lets selection math and persistence keep working.
 */
export function renderRichTextPreview(value: string, keyPrefix = "preview"): ReactNode[] {
  if (value.length === 0) {
    return [];
  }

  return renderSegments(value, keyPrefix);
}

function renderSegments(value: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const nextMatch = findNextMarkerMatch(value, cursor);
    if (!nextMatch) {
      nodes.push(<Fragment key={`${keyPrefix}-text-${cursor}`}>{value.slice(cursor)}</Fragment>);
      break;
    }

    if (nextMatch.openIndex > cursor) {
      nodes.push(
        <Fragment key={`${keyPrefix}-text-${cursor}`}>{value.slice(cursor, nextMatch.openIndex)}</Fragment>
      );
    }

    const innerStart = nextMatch.openIndex + nextMatch.openMarker.length;
    const innerEnd = nextMatch.closeIndex;
    nodes.push(
      <Fragment key={`${keyPrefix}-fmt-${nextMatch.openIndex}`}>
        <span className="gdoc-marker gdoc-marker-hidden" aria-hidden="true">
          {nextMatch.openMarker}
        </span>
        <span className={`gdoc-inline gdoc-inline-${nextMatch.type}`}>
          {renderSegments(value.slice(innerStart, innerEnd), `${keyPrefix}-${nextMatch.openIndex}`)}
        </span>
        <span className="gdoc-marker gdoc-marker-hidden" aria-hidden="true">
          {nextMatch.closeMarker}
        </span>
      </Fragment>
    );

    cursor = nextMatch.closeIndex + nextMatch.closeMarker.length;
  }

  return nodes;
}

function findNextMarkerMatch(value: string, startIndex: number): MarkerMatch | null {
  const candidates = [
    findPairedToken(value, startIndex, "**", "bold"),
    findPairedToken(value, startIndex, "~~", "strike"),
    findUnderlineToken(value, startIndex),
    findSingleAsteriskToken(value, startIndex),
  ].filter((candidate): candidate is MarkerMatch => candidate !== null);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.openIndex - right.openIndex);
  return candidates[0];
}

function findPairedToken(
  value: string,
  startIndex: number,
  token: string,
  type: Extract<PreviewFormat, "bold" | "strike">
): MarkerMatch | null {
  let openIndex = value.indexOf(token, startIndex);

  while (openIndex !== -1) {
    const closeIndex = value.indexOf(token, openIndex + token.length);
    if (closeIndex !== -1) {
      return {
        type,
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
        type: "underline",
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
        type: "italic",
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
