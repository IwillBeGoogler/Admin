import { useEffect, useRef, useState } from "react";

/**
 * Text input bound to a URL search param. Typing commits after `ms`
 * (trimmed, empty -> undefined); an outside change of `value` (Back button,
 * chip removal, "Clear filters") replaces the text without echoing it back.
 */
export function useSearchText(value: string | undefined, commit: (v: string | undefined) => void, ms = 300) {
  const [text, setText] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value ?? "");
  }
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onChange = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = v.trim() || undefined;
      if (next !== value) latest.current(next);
    }, ms);
  };
  return [text, onChange] as const;
}
