import { useState } from "react";

const KEY = "admin.recent";
const MAX = 5;

export const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
};

/** Most recent first, unique, at most 5; login is never recorded. */
export const pushRecent = (path: string) => {
  if (!path.startsWith("/") || path.startsWith("/login")) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([path, ...readRecent().filter((p) => p !== path)].slice(0, MAX)));
  } catch {}
};

/** Snapshot taken when the palette mounts (it remounts on every open). */
export const useRecent = () => useState(readRecent)[0];
