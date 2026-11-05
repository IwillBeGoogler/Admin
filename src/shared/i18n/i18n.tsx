import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { type Dict, en } from "./en";
import { ru } from "./ru";
import { uz } from "./uz";

export const locales = ["uz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };
const dicts: Record<Locale, Dict> = { en, uz, ru };

type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Dict>;

const KEY = "admin.locale";
export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (locales as readonly string[]).includes(v);

/** Stored choice, then the browser's language, then uz. */
export const detectLocale = (): Locale => {
  try {
    const s = localStorage.getItem(KEY);
    if (isLocale(s)) return s;
  } catch {}
  const nav = typeof navigator === "undefined" ? "" : navigator.language.slice(0, 2);
  return isLocale(nav) ? nav : "uz";
};

/** Current locale, read by the http client for Accept-Language. */
let current: Locale = typeof window === "undefined" ? "en" : detectLocale();
export const currentLocale = () => current;

export const translate = (locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string => {
  const walk = (d: unknown) =>
    key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], d);
  const raw = walk(dicts[locale]) ?? walk(en);
  const s = typeof raw === "string" ? raw : key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
};

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initial ?? current);
  current = locale;
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(KEY, locale);
    } catch {}
  }, [locale]);
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
  return <Ctx value={{ locale, setLocale, t }}>{children}</Ctx>;
}

export const useI18n = (): I18n => {
  const v = use(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
};
