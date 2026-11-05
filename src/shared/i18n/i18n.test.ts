import { describe, expect, it } from "vitest";
import { en } from "./en";
import { isLocale, translate } from "./i18n";
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
});
