import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import type { TextSelection } from "../types/api";
import { paginatePlainText, type PaginationPage } from "../lib/paginatePlainText";

const PAGE_INNER_WIDTH_PX = 624;
const PAGE_INNER_HEIGHT_PX = 864;
const EDITOR_FONT = '11pt "Arial"';
const EDITOR_LINE_HEIGHT_PX = 16.9;
const MAX_LINES_PER_PAGE = Math.floor(PAGE_INNER_HEIGHT_PX / EDITOR_LINE_HEIGHT_PX);

export interface PagedPlainTextEditorHandle {
  focus(): void;
  getSelection(): TextSelection;
  setSelection(selection: TextSelection): void;
}

interface PagedPlainTextEditorProps {
  value: string;
  onChange(nextValue: string): void;
  onSelectionChange(nextSelection: TextSelection): void;
  readOnly?: boolean;
  autoFocus?: boolean;
}

function createTextMeasurer(): (text: string) => number {
  if (typeof document === "undefined") {
    return (text) => text.length * 7.2;
  }

  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return (text) => text.length * 7.2;
  }

  let context: CanvasRenderingContext2D | null = null;
  try {
    const canvas = document.createElement("canvas");
    context = canvas.getContext("2d");
  } catch {
    context = null;
  }
  if (!context) {
    return (text) => text.length * 7.2;
  }

  context.font = EDITOR_FONT;
  return (text) => context.measureText(text).width;
}

function getTextOffset(root: HTMLElement, node: Node, nodeOffset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, nodeOffset);
  return range.toString().length;
}

function resolvePoint(root: HTMLElement, targetOffset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  let traversed = 0;
  let lastTextNode: Node | null = null;

  while (currentNode) {
    lastTextNode = currentNode;
    const textLength = currentNode.textContent?.length ?? 0;
    if (traversed + textLength >= targetOffset) {
      return {
        node: currentNode,
        offset: Math.max(0, targetOffset - traversed),
      };
    }
    traversed += textLength;
    currentNode = walker.nextNode();
  }

  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.textContent?.length ?? 0,
    };
  }

  return { node: root, offset: 0 };
}

function clampSelection(selection: TextSelection, maxLength: number): TextSelection {
  const start = Math.min(Math.max(selection.start, 0), maxLength);
  const end = Math.min(Math.max(selection.end, 0), maxLength);
  return start <= end ? { start, end } : { start: end, end: start };
}

function findPageIndexForOffset(pages: PaginationPage[], offset: number): number {
  if (pages.length === 0) {
    return 0;
  }

  const pageIndex = pages.findIndex((page, index) => {
    const nextPage = pages[index + 1];
    if (!nextPage) {
      return offset >= page.start && offset <= page.end;
    }
    return offset >= page.start && offset < nextPage.start;
  });

  return pageIndex === -1 ? pages.length - 1 : pageIndex;
}

/**
 * A paged editor keeps the plain-text storage contract intact while rendering
 * the content as fixed-height paper sheets. Each page is editable, and the
 * component restores the global selection after re-pagination so typing still
 * feels continuous instead of snapping the caret back to the top.
 */
export const PagedPlainTextEditor = forwardRef<PagedPlainTextEditorHandle, PagedPlainTextEditorProps>(
  ({ value, onChange, onSelectionChange, readOnly = false, autoFocus = false }, ref) => {
    const measurerRef = useRef<((text: string) => number) | null>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const latestSelectionRef = useRef<TextSelection>({ start: 0, end: 0 });
    const shouldRestoreSelectionRef = useRef(autoFocus);
    const lastPageCountRef = useRef(0);

    if (!measurerRef.current) {
      measurerRef.current = createTextMeasurer();
    }

    const pages = useMemo(
      () =>
        paginatePlainText(value, {
          maxLineWidthPx: PAGE_INNER_WIDTH_PX,
          maxLinesPerPage: MAX_LINES_PER_PAGE,
          measureTextWidth: measurerRef.current!,
        }),
      [value]
    );

    useEffect(() => {
      if (pages.length !== lastPageCountRef.current) {
        console.debug("[paged-editor] pagination_updated", {
          characters: value.length,
          pageCount: pages.length,
        });
        lastPageCountRef.current = pages.length;
      }
    }, [pages.length, value.length]);

    function hasFocusedPage(): boolean {
      const active = document.activeElement;
      if (!active) {
        return false;
      }

      for (const pageRef of pageRefs.current.values()) {
        if (pageRef === active || pageRef.contains(active)) {
          return true;
        }
      }

      return false;
    }

    function readSelectionFromDom(): TextSelection {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return latestSelectionRef.current;
      }

      const range = selection.getRangeAt(0);
      const startPageIndex = pages.findIndex((page) => pageRefs.current.get(page.index)?.contains(range.startContainer));
      const endPageIndex = pages.findIndex((page) => pageRefs.current.get(page.index)?.contains(range.endContainer));
      if (startPageIndex === -1 || endPageIndex === -1) {
        return latestSelectionRef.current;
      }

      const startPage = pages[startPageIndex];
      const endPage = pages[endPageIndex];
      const startRoot = pageRefs.current.get(startPage.index);
      const endRoot = pageRefs.current.get(endPage.index);
      if (!startRoot || !endRoot) {
        return latestSelectionRef.current;
      }

      return clampSelection(
        {
          start: startPage.start + getTextOffset(startRoot, range.startContainer, range.startOffset),
          end: endPage.start + getTextOffset(endRoot, range.endContainer, range.endOffset),
        },
        value.length
      );
    }

    function syncSelectionState(nextSelection: TextSelection) {
      latestSelectionRef.current = nextSelection;
      onSelectionChange(nextSelection);
    }

    function readNextValueFromDom(): string {
      return pages
        .map((page) => pageRefs.current.get(page.index)?.textContent ?? page.text)
        .join("");
    }

    function handleSelectionCapture() {
      syncSelectionState(readSelectionFromDom());
    }

    function handleInput() {
      const nextValue = readNextValueFromDom();
      const nextSelection = clampSelection(readSelectionFromDom(), nextValue.length);
      shouldRestoreSelectionRef.current = true;
      latestSelectionRef.current = nextSelection;
      onSelectionChange(nextSelection);
      onChange(nextValue);
    }

    function restoreSelection(selection: TextSelection) {
      const normalized = clampSelection(selection, value.length);
      const startPageIndex = findPageIndexForOffset(pages, normalized.start);
      const endPageIndex = findPageIndexForOffset(pages, normalized.end);
      const startPage = pages[startPageIndex];
      const endPage = pages[endPageIndex];
      const startRoot = pageRefs.current.get(startPage.index);
      const endRoot = pageRefs.current.get(endPage.index);
      if (!startRoot || !endRoot) {
        return;
      }

      const startPoint = resolvePoint(startRoot, normalized.start - startPage.start);
      const endPoint = resolvePoint(endRoot, normalized.end - endPage.start);
      const range = document.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);

      const selectionApi = window.getSelection();
      selectionApi?.removeAllRanges();
      selectionApi?.addRange(range);
    }

    useLayoutEffect(() => {
      if (!shouldRestoreSelectionRef.current && !hasFocusedPage()) {
        return;
      }

      restoreSelection(latestSelectionRef.current);
      shouldRestoreSelectionRef.current = false;
    }, [pages, value]);

    useEffect(() => {
      if (!autoFocus || readOnly) {
        return;
      }

      const firstPage = pageRefs.current.get(0);
      if (!firstPage) {
        return;
      }

      firstPage.focus();
      shouldRestoreSelectionRef.current = true;
      restoreSelection(latestSelectionRef.current);
    }, [autoFocus, readOnly, pages]);

    useImperativeHandle(ref, () => ({
      focus() {
        pageRefs.current.get(0)?.focus();
      },
      getSelection() {
        const nextSelection = readSelectionFromDom();
        latestSelectionRef.current = nextSelection;
        return nextSelection;
      },
      setSelection(selection) {
        latestSelectionRef.current = clampSelection(selection, value.length);
        shouldRestoreSelectionRef.current = true;
        const targetPageIndex = findPageIndexForOffset(pages, latestSelectionRef.current.start);
        pageRefs.current.get(targetPageIndex)?.focus();
        restoreSelection(latestSelectionRef.current);
      },
    }));

    return (
      <div className="gdoc-page-stack" data-testid="paged-editor-root">
        {pages.map((page) => (
          <article key={`${page.start}-${page.end}`} className="gdoc-page">
            <div
              ref={(node) => {
                if (node) {
                  pageRefs.current.set(page.index, node);
                } else {
                  pageRefs.current.delete(page.index);
                }
              }}
              className="gdoc-editor"
              contentEditable={readOnly ? "false" : "plaintext-only"}
              suppressContentEditableWarning
              role={readOnly ? "document" : "textbox"}
              aria-label={`Document content page ${page.index + 1}`}
              aria-multiline="true"
              spellCheck
              data-placeholder={page.index === 0 ? "Start typing…" : ""}
              onInput={handleInput}
              onKeyUp={handleSelectionCapture}
              onMouseUp={handleSelectionCapture}
              onFocus={handleSelectionCapture}
            >
              {page.text}
            </div>
          </article>
        ))}
      </div>
    );
  }
);

PagedPlainTextEditor.displayName = "PagedPlainTextEditor";
