import { useEffect, useRef } from "react";

/**
 * Tiny keyboard-shortcut dispatcher (no dependency).
 *
 * Key syntax: `"j"`, `"?"`, `"escape"`, `"enter"`, `"mod+k"` (Ctrl or Cmd),
 * `"shift+x"`, and two-step sequences `"g d"` (second key within 1 s).
 * One document listener serves every mounted hook; layers mounted later win.
 */
export type HotkeyHandler = (e: KeyboardEvent) => void;
export interface HotkeyBinding {
  handler: HotkeyHandler;
  /** Also fire while focus is in input/textarea/select/contenteditable. */
  allowInInput?: boolean;
  /** Also fire while a modal dialog is open. */
  allowInDialog?: boolean;
}
export type Hotkeys = Record<string, HotkeyHandler | HotkeyBinding | false | undefined | null>;

const SEQUENCE_TIMEOUT = 1000;
const layers: { current: Hotkeys }[] = [];
let buffer: string | null = null;
let bufferTimer: ReturnType<typeof setTimeout> | undefined;

export const isTypingTarget = (t: EventTarget | null): boolean => {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.closest("[contenteditable=''],[contenteditable='true']")) return true;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (t as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes(type);
};

export const isDialogOpen = (): boolean =>
  document.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]') !== null;

/** Normalised token for one key press, e.g. "mod+k", "?", "shift+j", "escape". */
export const eventToken = (e: KeyboardEvent): string => {
  const raw = e.key.toLowerCase();
  const key = raw === "esc" ? "escape" : raw === " " ? "space" : raw;
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push("mod");
  if (e.altKey) mods.push("alt");
  // Shift is implied by printable symbols such as "?"; keep it only for letters and named keys.
  if (e.shiftKey && (key.length > 1 || /[a-z]/.test(key))) mods.push("shift");
  return [...mods, key].join("+");
};

const binding = (b: Hotkeys[string]): HotkeyBinding | null =>
  !b ? null : typeof b === "function" ? { handler: b } : b;

const find = (combo: string): HotkeyBinding | null => {
  for (let i = layers.length - 1; i >= 0; i--) {
    const b = binding(layers[i]?.current[combo]);
    if (b) return b;
  }
  return null;
};

const isPrefix = (token: string) =>
  layers.some((l) => Object.keys(l.current).some((k) => !!l.current[k] && k.startsWith(`${token} `)));

const clearBuffer = () => {
  buffer = null;
  clearTimeout(bufferTimer);
};

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;
  const token = eventToken(e);
  if (["shift", "control", "meta", "alt", "mod+control", "mod+meta"].includes(token)) return;
  const typing = isTypingTarget(e.target);
  const dialog = isDialogOpen();
  const allowed = (b: HotkeyBinding) => (!typing || b.allowInInput) && (!dialog || b.allowInDialog);

  if (buffer) {
    const seq = find(`${buffer} ${token}`);
    clearBuffer();
    if (seq && allowed(seq)) {
      e.preventDefault();
      seq.handler(e);
      return;
    }
  }
  if (!typing && !dialog && isPrefix(token)) {
    buffer = token;
    bufferTimer = setTimeout(clearBuffer, SEQUENCE_TIMEOUT);
    return;
  }
  const b = find(token);
  if (b && allowed(b)) {
    e.preventDefault();
    b.handler(e);
  }
}

/** Register shortcuts while mounted. Handlers may change every render. */
export function useHotkeys(keys: Hotkeys, enabled = true) {
  const ref = useRef(keys);
  useEffect(() => {
    ref.current = keys;
  });
  useEffect(() => {
    if (!enabled) return;
    const layer = ref;
    layers.push(layer);
    if (layers.length === 1) document.addEventListener("keydown", onKeyDown);
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      if (layers.length === 0) {
        document.removeEventListener("keydown", onKeyDown);
        clearBuffer();
      }
    };
  }, [enabled]);
}

/** Display form of a key spec: "mod+k" -> ["⌘", "K"] on Apple, ["Ctrl", "K"] elsewhere. */
export const keyLabels = (spec: string): string[][] => {
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const names: Record<string, string> = {
    mod: apple ? "⌘" : "Ctrl",
    shift: "Shift",
    alt: apple ? "⌥" : "Alt",
    escape: "Esc",
    enter: "Enter",
    space: "Space",
  };
  return spec.split(" ").map((step) => step.split("+").map((k) => names[k] ?? k.toUpperCase()));
};
