import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "./en";
import { detectLocale, isLocale, translate } from "./i18n";
import { ru } from "./ru";
import { uz } from "./uz";

const keys = (o: object, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [`${p}${k}`] : keys(v, `${p}${k}.`)));

describe("i18n", () => {
  it("every locale has every key", () => {
    const base = keys(en).sort();
    expect(keys(uz).sort()).toEqual(base);
    expect(keys(ru).sort()).toEqual(base);
  });
  it("interpolates vars", () => {
    expect(translate("en", "users.banTitle", { name: "ali" })).toBe("Sanction @ali");
    expect(translate("uz", "common.total", { n: 3 })).toBe("Jami 3");
    expect(translate("ru", "common.total")).toBe("Всего {n}");
  });
  it("validates locales", () => {
    expect(isLocale("uz")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });
  it("falls back to the key for an unknown key and keeps unmatched vars", () => {
    expect(translate("en", "no.such.key" as never)).toBe("no.such.key");
    expect(translate("en", "users.banTitle", {})).toBe("Sanction @{name}");
  });
});

describe("detectLocale", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  it("prefers the stored locale", () => {
    localStorage.setItem("admin.locale", "ru");
    expect(detectLocale()).toBe("ru");
  });
  it("uses the browser language, then uz", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    expect(detectLocale()).toBe("en");
    vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
    expect(detectLocale()).toBe("uz");
  });
  it("survives unreadable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(navigator, "language", "get").mockReturnValue("ru-RU");
    expect(detectLocale()).toBe("ru");
  });
});
