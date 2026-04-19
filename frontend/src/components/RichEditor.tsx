import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { TextSelection } from "../types/api";
import type { RemotePeer } from "../services/realtime";

export interface FormattingState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
  justifyFull: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
  fontName: string;
  fontSize: string;
  formatBlock: string;
}

export const INITIAL_FORMATTING: FormattingState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  justifyLeft: true,
  justifyCenter: false,
  justifyRight: false,
  justifyFull: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  fontName: "Arial",
  fontSize: "3",
  formatBlock: "p",
};

export interface RichEditorHandle {
  format(command: string, value?: string): void;
  captureSelection(): string;
  getSelection(): TextSelection;
  setSelection(selection: TextSelection): void;
  replaceSelection(text: string, selection?: TextSelection): void;
  getHTML(): string;
  focus(): void;
}

interface RichEditorProps {
  value: string;
  onChange(html: string): void;
  onFormattingChange?(state: FormattingState): void;
  onSelectionChange?(selection: TextSelection, selectedText: string): void;
  remotePeers?: RemotePeer[];
  readOnly?: boolean;
  className?: string;
  autoFocus?: boolean;
}

interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RemotePeerDecoration {
  clientId: number;
  userId: string;
  color: string;
  selectionRects: RectBox[];
  caret: RectBox | null;
  labelTop: number;
  labelLeft: number;
}

function queryState(): FormattingState {
  const qs = (cmd: string): boolean => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };
  const qv = (cmd: string): string => {
    try {
      return document.queryCommandValue(cmd) ?? "";
    } catch {
      return "";
    }
  };

  return {
    bold: qs("bold"),
    italic: qs("italic"),
    underline: qs("underline"),
    strikeThrough: qs("strikeThrough"),
    justifyLeft: qs("justifyLeft"),
    justifyCenter: qs("justifyCenter"),
    justifyRight: qs("justifyRight"),
    justifyFull: qs("justifyFull"),
    insertUnorderedList: qs("insertUnorderedList"),
    insertOrderedList: qs("insertOrderedList"),
    fontName: qv("fontName").replace(/^"|"$/g, ""),
    fontSize: qv("fontSize"),
    formatBlock: qv("formatBlock").toLowerCase().replace(/^<|>$/g, ""),
  };
}

function toHTML(raw: string): string {
  if (!raw) return "<p><br></p>";
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw
    .split("\n")
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}

function isNodeInsideEditor(editor: HTMLDivElement, node: Node | null): boolean {
  if (!node) return false;
  return editor.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node);
}

function getEditorRange(editor: HTMLDivElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  if (!isNodeInsideEditor(editor, selection.anchorNode) || !isNodeInsideEditor(editor, selection.focusNode)) {
    return null;
  }
  return selection.getRangeAt(0).cloneRange();
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

function restoreRange(range: Range | null) {
  if (!range) return;
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function rectToBox(rect: DOMRect, containerRect: DOMRect): RectBox {
  return {
    left: rect.left - containerRect.left,
    top: rect.top - containerRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function measureRemotePeerDecorations(editor: HTMLDivElement, remotePeers: RemotePeer[]): RemotePeerDecoration[] {
  const containerRect = editor.getBoundingClientRect();
  const decorations: RemotePeerDecoration[] = [];

  for (const peer of remotePeers) {
    const selection = peer.selection;
    const cursorOffset = selection ? selection.end : typeof peer.cursor === "number" ? peer.cursor : null;
    const selectionRects: RectBox[] = [];
    let caret: RectBox | null = null;
    let labelTop = 0;
    let labelLeft = 0;

    try {
      if (selection && selection.end > selection.start) {
        const range = document.createRange();
        const start = resolvePoint(editor, selection.start);
        const end = resolvePoint(editor, selection.end);
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        const clientRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
        selectionRects.push(...clientRects.map((rect) => rectToBox(rect, containerRect)));
      }

      if (cursorOffset !== null) {
        const cursorRange = document.createRange();
        const point = resolvePoint(editor, cursorOffset);
        cursorRange.setStart(point.node, point.offset);
        cursorRange.setEnd(point.node, point.offset);
        const caretRect = cursorRange.getBoundingClientRect();
        if (caretRect.height > 0) {
          caret = {
            left: caretRect.left - containerRect.left,
            top: caretRect.top - containerRect.top,
            width: Math.max(caretRect.width, 2),
            height: caretRect.height,
          };
        }
      }
    } catch {
      continue;
    }

    const anchor = selectionRects[0] || caret;
    if (!anchor) {
      continue;
    }

    labelTop = Math.max(anchor.top - 24, 0);
    labelLeft = Math.max(anchor.left, 0);

    decorations.push({
      clientId: peer.clientId,
      userId: peer.userId,
      color: peer.color,
      selectionRects,
      caret,
      labelTop,
      labelLeft,
    });
  }

  return decorations;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  ({ value, onChange, onFormattingChange, onSelectionChange, remotePeers = [], readOnly = false, className, autoFocus = false }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);
    const savedRange = useRef<Range | null>(null);
    const [remoteDecorations, setRemoteDecorations] = useState<RemotePeerDecoration[]>([]);

    function rememberSelection() {
      if (!divRef.current) return;
      const range = getEditorRange(divRef.current);
      if (range) {
        savedRange.current = range;
      }
    }

    function readSelection(): TextSelection {
      if (!divRef.current) {
        return { start: 0, end: 0 };
      }
      const range = getEditorRange(divRef.current);
      if (!range) {
        return { start: 0, end: 0 };
      }

      const start = getTextOffset(divRef.current, range.startContainer, range.startOffset);
      const end = getTextOffset(divRef.current, range.endContainer, range.endOffset);
      return clampSelection({ start, end }, divRef.current.textContent?.length ?? 0);
    }

    function emitSelection() {
      if (!divRef.current) {
        return;
      }
      const selection = readSelection();
      const selectedText = window.getSelection()?.toString() ?? "";
      onSelectionChange?.(selection, selectedText);
      onFormattingChange?.(queryState());
    }

    useEffect(() => {
      if (!divRef.current) {
        return;
      }
      const nextHTML = toHTML(value);
      if (divRef.current.innerHTML !== nextHTML) {
        divRef.current.innerHTML = nextHTML;
      }
      if (autoFocus) {
        divRef.current.focus();
      }
    }, [autoFocus, value]);

    useEffect(() => {
      const editor = divRef.current;
      if (!editor) {
        return;
      }

      const refresh = () => {
        setRemoteDecorations(measureRemotePeerDecorations(editor, remotePeers));
      };

      refresh();
      window.addEventListener("resize", refresh);
      return () => {
        window.removeEventListener("resize", refresh);
      };
    }, [remotePeers, value]);

    useEffect(() => {
      function handleSelectionChange() {
        if (!divRef.current) {
          return;
        }
        const selection = window.getSelection();
        if (!selection || !divRef.current.contains(selection.focusNode)) {
          return;
        }
        rememberSelection();
        emitSelection();
      }

      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [onFormattingChange, onSelectionChange]);

    useImperativeHandle(ref, () => ({
      format(command, valueArg) {
        divRef.current?.focus();
        restoreRange(savedRange.current);
        document.execCommand(command, false, valueArg ?? undefined);
        rememberSelection();
        onChange(divRef.current?.innerHTML ?? "");
        emitSelection();
      },

      captureSelection() {
        rememberSelection();
        return window.getSelection()?.toString() ?? "";
      },

      getSelection() {
        return readSelection();
      },

      setSelection(selection) {
        if (!divRef.current) {
          return;
        }
        const normalized = clampSelection(selection, divRef.current.textContent?.length ?? 0);
        const range = document.createRange();
        const start = resolvePoint(divRef.current, normalized.start);
        const end = resolvePoint(divRef.current, normalized.end);
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        savedRange.current = range;
        restoreRange(range);
      },

      replaceSelection(text, selection) {
        divRef.current?.focus();
        if (selection) {
          const normalized = clampSelection(selection, divRef.current?.textContent?.length ?? 0);
          const range = document.createRange();
          const start = resolvePoint(divRef.current!, normalized.start);
          const end = resolvePoint(divRef.current!, normalized.end);
          range.setStart(start.node, start.offset);
          range.setEnd(end.node, end.offset);
          savedRange.current = range;
        }
        restoreRange(savedRange.current);
        const ok = document.execCommand("insertText", false, text);
        if (!ok) {
          const selectionRef = window.getSelection();
          if (selectionRef && selectionRef.rangeCount > 0) {
            selectionRef.deleteFromDocument();
            selectionRef.getRangeAt(0).insertNode(document.createTextNode(text));
          }
        }
        onChange(divRef.current?.innerHTML ?? "");
        savedRange.current = null;
      },

      getHTML: () => divRef.current?.innerHTML ?? "",
      focus: () => divRef.current?.focus(),
    }));

    function handleKeyDown(event: React.KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      const map: Record<string, [string, string?]> = {
        b: ["bold"],
        i: ["italic"],
        u: ["underline"],
        z: event.shiftKey ? ["redo"] : ["undo"],
        y: ["redo"],
      };
      if (!map[key]) return;
      event.preventDefault();
      const [command, valueArg] = map[key];
      document.execCommand(command, false, valueArg);
      rememberSelection();
      onChange(divRef.current?.innerHTML ?? "");
      emitSelection();
    }

    return (
      <div className={className}>
        <div className="rich-editor-shell">
          <div
            ref={divRef}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className="gdoc-editor rich-editor-content"
            onInput={() => {
              rememberSelection();
              onChange(divRef.current?.innerHTML ?? "");
            }}
            onKeyDown={handleKeyDown}
            onMouseUp={() => {
              rememberSelection();
              emitSelection();
            }}
            onKeyUp={() => {
              rememberSelection();
              emitSelection();
            }}
            onFocus={() => {
              rememberSelection();
              emitSelection();
            }}
            aria-label="Document content"
            aria-multiline="true"
            role={readOnly ? "document" : "textbox"}
            spellCheck
            data-placeholder="Start typing..."
            data-testid="document-editor"
          />

          {remoteDecorations.length > 0 && (
            <div className="gdoc-remote-layer" aria-hidden="true">
              {remoteDecorations.map((peer) => (
                <div key={peer.clientId} className="gdoc-remote-peer-layer">
                  {peer.selectionRects.map((rect, index) => (
                    <div
                      key={`${peer.clientId}-selection-${index}`}
                      className="gdoc-remote-selection"
                      style={{
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        backgroundColor: peer.color,
                      }}
                    />
                  ))}
                  {peer.caret && (
                    <div
                      className="gdoc-remote-caret"
                      style={{
                        left: peer.caret.left,
                        top: peer.caret.top,
                        height: peer.caret.height,
                        backgroundColor: peer.color,
                      }}
                    />
                  )}
                  <div
                    className="gdoc-remote-label"
                    style={{
                      left: peer.labelLeft,
                      top: peer.labelTop,
                      backgroundColor: peer.color,
                    }}
                  >
                    {peer.userId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

RichEditor.displayName = "RichEditor";
