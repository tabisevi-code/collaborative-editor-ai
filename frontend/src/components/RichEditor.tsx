import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// ── Formatting state ────────────────────────────────────────────────────────
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
  bold: false, italic: false, underline: false, strikeThrough: false,
  justifyLeft: true, justifyCenter: false, justifyRight: false, justifyFull: false,
  insertUnorderedList: false, insertOrderedList: false,
  fontName: "Arial", fontSize: "3", formatBlock: "p",
};

// ── Imperative handle ───────────────────────────────────────────────────────
export interface RichEditorHandle {
  /** Execute a formatting command (preserves selection across focus loss). */
  format(command: string, value?: string): void;
  /** Snapshot the current selection text and save the range for later replaceSelection(). */
  captureSelection(): string;
  /** Replace the saved selection with new HTML (used by AI apply). */
  replaceSelection(html: string): void;
  getHTML(): string;
  focus(): void;
}

interface RichEditorProps {
  initialHTML: string;
  onChange(html: string): void;
  onSelectionChange(state: FormattingState): void;
  readOnly?: boolean;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function queryState(): FormattingState {
  const qs = (cmd: string): boolean => { try { return document.queryCommandState(cmd); } catch { return false; } };
  const qv = (cmd: string): string  => { try { return document.queryCommandValue(cmd) ?? ""; } catch { return ""; } };
  return {
    bold: qs("bold"), italic: qs("italic"), underline: qs("underline"), strikeThrough: qs("strikeThrough"),
    justifyLeft: qs("justifyLeft"), justifyCenter: qs("justifyCenter"),
    justifyRight: qs("justifyRight"), justifyFull: qs("justifyFull"),
    insertUnorderedList: qs("insertUnorderedList"), insertOrderedList: qs("insertOrderedList"),
    fontName: qv("fontName").replace(/^"|"$/g, ""),
    fontSize: qv("fontSize"),
    formatBlock: qv("formatBlock").toLowerCase().replace(/^<|>$/g, ""),
  };
}

/** Convert plain text to basic HTML paragraphs if no tags detected. */
function toHTML(raw: string): string {
  if (!raw) return "<p><br></p>";
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw.split("\n").map((line) => `<p>${line || "<br>"}</p>`).join("");
}

function saveRange(): Range | null {
  const sel = window.getSelection();
  return sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
}

function restoreRange(range: Range | null) {
  if (!range) return;
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// ── Component ───────────────────────────────────────────────────────────────
export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  ({ initialHTML, onChange, onSelectionChange, readOnly = false, className }, ref) => {
    const divRef      = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);
    const savedRange  = useRef<Range | null>(null);

    // Set initial content only once when document loads
    useEffect(() => {
      if (!divRef.current || initialized.current) return;
      initialized.current = true;
      divRef.current.innerHTML = toHTML(initialHTML);
    }, [initialHTML]);

    // Track selection changes to update toolbar state
    useEffect(() => {
      function handleSelectionChange() {
        if (!divRef.current) return;
        const sel = window.getSelection();
        if (!sel || !divRef.current.contains(sel.focusNode)) return;
        onSelectionChange(queryState());
      }
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [onSelectionChange]);

    // ── Imperative API ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      format(command, value) {
        const range = saveRange();
        divRef.current?.focus();
        if (range) restoreRange(range);
        document.execCommand(command, false, value ?? undefined);
        onChange(divRef.current?.innerHTML ?? "");
        onSelectionChange(queryState());
      },

      captureSelection() {
        savedRange.current = saveRange();
        return window.getSelection()?.toString() ?? "";
      },

      replaceSelection(html) {
        divRef.current?.focus();
        if (savedRange.current) restoreRange(savedRange.current);
        // Prefer insertHTML; fall back to insertText
        const ok = document.execCommand("insertHTML", false, html);
        if (!ok) document.execCommand("insertText", false, html);
        onChange(divRef.current?.innerHTML ?? "");
        savedRange.current = null;
      },

      getHTML: () => divRef.current?.innerHTML ?? "",
      focus:   () => divRef.current?.focus(),
    }));

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    function handleKeyDown(e: React.KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      const map: Record<string, [string, string?]> = {
        b: ["bold"],
        i: ["italic"],
        u: ["underline"],
        z: e.shiftKey ? ["redo"] : ["undo"],
        y: ["redo"],
      };
      if (!map[key]) return;
      e.preventDefault();
      const [cmd, val] = map[key];
      document.execCommand(cmd, false, val);
      onChange(divRef.current?.innerHTML ?? "");
      onSelectionChange(queryState());
    }

    function handleInput() {
      onChange(divRef.current?.innerHTML ?? "");
    }

    function handleMouseUp() {
      onSelectionChange(queryState());
    }

    function handleKeyUp() {
      onSelectionChange(queryState());
    }

    return (
      <div
        ref={divRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={className}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={handleMouseUp}
        onKeyUp={handleKeyUp}
        aria-label="Document content"
        aria-multiline="true"
        role={readOnly ? "document" : "textbox"}
        spellCheck
        data-placeholder="Start typing…"
      />
    );
  }
);

RichEditor.displayName = "RichEditor";
