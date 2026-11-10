import { useEffect, useState } from "react";
import { settingsSync } from "@/shared/settingsSync";

const read = <T extends string>(key: string, fallback: T, allowed: readonly T[]): T => {
  try {
    const v = localStorage.getItem(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * String state persisted in localStorage; unknown stored values fall back.
 * With `syncKey` the value is also kept in the signed-in user's server settings.
 */
export function useStoredState<T extends string>(key: string, fallback: T, allowed: readonly T[], syncKey?: string) {
  const [value, setState] = useState<T>(() => read(key, fallback, allowed));
  const setValue = (v: T) => {
    setState(v);
    if (syncKey) settingsSync.push(syncKey, v);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: allowed is a static list
  useEffect(() => {
    if (!syncKey) return;
    return settingsSync.register({
      key: syncKey,
      get: () => {
        try {
          return localStorage.getItem(key) ?? undefined;
        } catch {
          return undefined;
        }
      },
      apply: (v) => typeof v === "string" && (allowed as readonly string[]).includes(v) && setState(v as T),
    });
  }, [key, syncKey]);
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}
