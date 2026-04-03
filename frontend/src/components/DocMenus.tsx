/**
 * DocMenus — all eight menu-bar drop-downs for the document editor.
 *
 * Each exported component wraps <DropdownMenu> with a fixed list of items.
 * Actions that already exist on the toolbar (undo, redo, bold …) are wired
 * through callback props so the menus and toolbar stay in sync.
 */

import { DropdownMenu } from "./ui/DropdownMenu";
import type { ToolbarAction } from "../lib/richTextToolbar";

/* ── shared helpers ─────────────────────────────────────────────────── */

const SEP = { type: "separator" as const };

/* ═══════════════════════════════════════════════════════════════════════
   FILE
   ═══════════════════════════════════════════════════════════════════════ */

interface FileMenuProps {
  onShare?(): void;
  onExport?(): void;
  onHistory?(): void;
  onPrint?(): void;
}

export function FileMenu({ onShare, onExport, onHistory, onPrint }: FileMenuProps) {
  return (
    <DropdownMenu
      label="文件"
      items={[
        { label: "新建", shortcut: "Ctrl+N", disabled: true },
        SEP,
        { label: "分享", onClick: onShare, disabled: !onShare },
        { label: "導出", onClick: onExport, disabled: !onExport },
        SEP,
        { label: "版本歷史", onClick: onHistory, disabled: !onHistory },
        SEP,
        { label: "打印", shortcut: "Ctrl+P", onClick: onPrint ?? (() => window.print()) },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT
   ═══════════════════════════════════════════════════════════════════════ */

interface EditMenuProps {
  onToolbarAction?(action: ToolbarAction): void;
  readOnly?: boolean;
}

export function EditMenu({ onToolbarAction, readOnly }: EditMenuProps) {
  const act = (a: ToolbarAction) => () => onToolbarAction?.(a);
  return (
    <DropdownMenu
      label="編輯"
      items={[
        { label: "撤銷",   shortcut: "Ctrl+Z", onClick: act("undo"),   disabled: readOnly || !onToolbarAction },
        { label: "重做",   shortcut: "Ctrl+Y", onClick: act("redo"),   disabled: readOnly || !onToolbarAction },
        SEP,
        { label: "剪切",   shortcut: "Ctrl+X", disabled: true },
        { label: "複製",   shortcut: "Ctrl+C", disabled: true },
        { label: "粘貼",   shortcut: "Ctrl+V", disabled: true },
        SEP,
        { label: "全選",   shortcut: "Ctrl+A", onClick: () => document.execCommand("selectAll") },
        { label: "查找與替換", shortcut: "Ctrl+H", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   VIEW
   ═══════════════════════════════════════════════════════════════════════ */

export function ViewMenu() {
  return (
    <DropdownMenu
      label="視圖"
      items={[
        { label: "100%", disabled: true },
        SEP,
        { label: "打印佈局",   disabled: true },
        { label: "無頁面佈局", disabled: true },
        SEP,
        { label: "全屏",      disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INSERT
   ═══════════════════════════════════════════════════════════════════════ */

export function InsertMenu() {
  return (
    <DropdownMenu
      label="插入"
      items={[
        { label: "圖像",     disabled: true },
        { label: "鏈接",     shortcut: "Ctrl+K", disabled: true },
        SEP,
        { label: "表格",     disabled: true },
        { label: "水平線",   disabled: true },
        SEP,
        { label: "頁眉與頁腳", disabled: true },
        { label: "腳註",     disabled: true },
        SEP,
        { label: "特殊字符", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FORMAT
   ═══════════════════════════════════════════════════════════════════════ */

interface FormatMenuProps {
  onToolbarAction?(action: ToolbarAction): void;
  readOnly?: boolean;
}

export function FormatMenu({ onToolbarAction, readOnly }: FormatMenuProps) {
  const act = (a: ToolbarAction) => () => onToolbarAction?.(a);
  return (
    <DropdownMenu
      label="格式"
      items={[
        { label: "粗體",       shortcut: "Ctrl+B", onClick: act("bold"),      disabled: readOnly || !onToolbarAction },
        { label: "斜體",       shortcut: "Ctrl+I", onClick: act("italic"),    disabled: readOnly || !onToolbarAction },
        { label: "下劃線",     shortcut: "Ctrl+U", onClick: act("underline"), disabled: readOnly || !onToolbarAction },
        { label: "刪除線",     onClick: act("strike"),    disabled: readOnly || !onToolbarAction },
        SEP,
        { label: "項目符號列表", onClick: act("bulletList"),  disabled: readOnly || !onToolbarAction },
        { label: "編號列表",    onClick: act("numberedList"), disabled: readOnly || !onToolbarAction },
        SEP,
        { label: "清除格式",   shortcut: "Ctrl+\\", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TOOLS
   ═══════════════════════════════════════════════════════════════════════ */

export function ToolsMenu() {
  return (
    <DropdownMenu
      label="工具"
      items={[
        { label: "拼寫檢查",   disabled: true },
        { label: "字數統計",   disabled: true },
        SEP,
        { label: "可訪問性",   disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EXTENSIONS
   ═══════════════════════════════════════════════════════════════════════ */

export function ExtensionsMenu() {
  return (
    <DropdownMenu
      label="擴展"
      items={[
        { label: "管理擴展",   disabled: true },
        SEP,
        { label: "獲取擴展程序", disabled: true },
      ]}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HELP
   ═══════════════════════════════════════════════════════════════════════ */

export function HelpMenu() {
  return (
    <DropdownMenu
      label="幫助"
      items={[
        { label: "鍵盤快捷鍵", shortcut: "Ctrl+/", disabled: true },
        SEP,
        { label: "關於此編輯器", disabled: true },
        { label: "發送反饋",   disabled: true },
      ]}
    />
  );
}
