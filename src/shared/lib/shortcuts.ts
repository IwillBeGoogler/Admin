import type { MessageKey } from "@/shared/i18n";

/**
 * Single registry of keyboard shortcuts. Components bind these exact keys and
 * the help dialog (`?`) renders this list, so docs cannot drift from code.
 * Navigation "g <key>" bindings come from `hotkey` in app/nav.ts.
 */
export const shortcuts = {
  palette: { keys: "mod+k", label: "shortcuts.palette" },
  help: { keys: "?", label: "shortcuts.help" },
  sidebar: { keys: "mod+b", label: "shortcuts.sidebar" },
  focusSearch: { keys: "/", label: "shortcuts.focusSearch" },
  newItem: { keys: "n", label: "shortcuts.newItem" },
  nextRow: { keys: "j", label: "shortcuts.nextRow" },
  prevRow: { keys: "k", label: "shortcuts.prevRow" },
  toggleRow: { keys: "x", label: "shortcuts.toggleRow" },
  openRow: { keys: "enter", label: "shortcuts.openRow" },
  clearSelection: { keys: "escape", label: "shortcuts.clearSelection" },
  save: { keys: "mod+s", label: "shortcuts.save" },
  publish: { keys: "mod+enter", label: "shortcuts.publish" },
} as const satisfies Record<string, { keys: string; label: MessageKey }>;

export type ShortcutId = keyof typeof shortcuts;

export const shortcutGroups: { label: MessageKey; ids: ShortcutId[] }[] = [
  { label: "shortcuts.global", ids: ["palette", "help", "sidebar"] },
  {
    label: "shortcuts.list",
    ids: ["focusSearch", "newItem", "nextRow", "prevRow", "toggleRow", "openRow", "clearSelection"],
  },
  { label: "shortcuts.editor", ids: ["save", "publish"] },
];

export const key = (id: ShortcutId) => shortcuts[id].keys;
