import type { TextSelection } from "../types/api";

/**
 * The document page should talk to an editor contract instead of a concrete
 * widget so we can upgrade the visual editor without rewriting autosave, AI
 * apply, and collaboration flows each time.
 */
export interface DocumentEditorAdapter {
  focus(): void;
  getContent(): string;
  setContent(nextValue: string): void;
  getSelection(): TextSelection;
  setSelection(selection: TextSelection): void;
  replaceSelection(selection: TextSelection, replacement: string): string;
}
