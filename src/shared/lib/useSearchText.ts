import { useEffect, useRef, useState } from "react";

/**
 * Text input bound to a URL search param. Typing commits after `ms`
 * (trimmed, empty -> undefined); an outside change of `value` (Back button,
 * chip removal, "Clear filters") replaces the text without echoing it back.
 */
export function useSearchText(value: string | undefined, commit: (v: string | undefined) => void, ms = 300) {
  const [text, setText] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** what this input last committed: its own echo must not rewrite the text (it would eat a trailing space) */
  const committed = useRef(value);
  if (seen !== value) {
    setSeen(value);
    if (value !== committed.current) {
      clearTimeout(timer.current); // an outside change (Clear filters) cancels a pending commit
      setText(value ?? "");
    }
    committed.current = value;
  }
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  const onChange = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = v.trim() || undefined;
      if (next !== value) {
        committed.current = next;
        latest.current(next);
      }
    }, ms);
  };
  return [text, onChange] as const;
}
