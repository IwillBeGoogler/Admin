import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "@/shared/i18n/i18n";
import { useStoredState } from "@/shared/lib/useStoredState";
import { settingsSync } from "@/shared/settingsSync";
import { ThemeProvider, useTheme } from "@/shared/ui/theme";

type Registered = { key: string; get: () => unknown; apply: (v: unknown) => void };

/** Capture what a hook registers with settingsSync and what it pushes. */
const spy = () => {
  const registered: Registered[] = [];
  const reg = vi.spyOn(settingsSync, "register").mockImplementation((s) => {
    registered.push(s as Registered);
    return () => {};
  });
  const push = vi.spyOn(settingsSync, "push").mockImplementation(() => {});
  return { registered, reg, push };
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
afterEach(() => vi.restoreAllMocks());

describe("I18nProvider sync", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider initial="en">{children}</I18nProvider>;

  it("pushes locale changes and persists them", () => {
    const { push } = spy();
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale("ru"));
    expect(push).toHaveBeenCalledWith("admin.lang", "ru");
    expect(localStorage.getItem("admin.locale")).toBe("ru");
    expect(document.documentElement.lang).toBe("ru");
  });

  it("reads the stored locale and applies only valid server values", () => {
    const { registered } = spy();
    const { result } = renderHook(() => useI18n(), { wrapper });
    const s = registered.find((r) => r.key === "admin.lang");
    expect(s?.get()).toBe("en");
    localStorage.setItem("admin.locale", "xx");
    expect(s?.get()).toBeUndefined();
    act(() => s?.apply("uz"));
    expect(result.current.locale).toBe("uz");
    act(() => s?.apply("klingon"));
    expect(result.current.locale).toBe("uz");
  });

  it("get tolerates unavailable storage", () => {
    const { registered } = spy();
    renderHook(() => useI18n(), { wrapper });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(registered.find((r) => r.key === "admin.lang")?.get()).toBeUndefined();
  });

  it("useI18n throws outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useI18n())).toThrow(/outside I18nProvider/);
  });
});

describe("ThemeProvider sync", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

  it("pushes theme changes, persists explicit themes, clears for system", () => {
    const { push } = spy();
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("system");
    act(() => result.current.setTheme("dark"));
    expect(push).toHaveBeenCalledWith("admin.theme", "dark");
    expect(localStorage.getItem("admin.theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    act(() => result.current.setTheme("system"));
    expect(localStorage.getItem("admin.theme")).toBeNull();
  });

  it("restores a stored theme", () => {
    spy();
    localStorage.setItem("admin.theme", "light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
  });

  it("registered get/apply: valid values apply, junk is ignored", () => {
    const { registered } = spy();
    const { result } = renderHook(() => useTheme(), { wrapper });
    const s = registered.find((r) => r.key === "admin.theme");
    expect(s?.get()).toBeUndefined();
    act(() => s?.apply("dark"));
    expect(result.current.theme).toBe("dark");
    expect(s?.get()).toBe("dark");
    act(() => s?.apply("neon"));
    expect(result.current.theme).toBe("dark");
  });

  it("tolerates unavailable storage", () => {
    const { registered } = spy();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("system");
    expect(registered.find((r) => r.key === "admin.theme")?.get()).toBeUndefined();
    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
  });

  it("useTheme throws outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(/outside ThemeProvider/);
  });
});

describe("useStoredState sync", () => {
  const allowed = ["a", "b"] as const;

  it("falls back for unknown stored values and when storage throws", () => {
    spy();
    localStorage.setItem("k", "zzz");
    expect(renderHook(() => useStoredState("k", "a", allowed)).result.current[0]).toBe("a");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(renderHook(() => useStoredState("k", "b", allowed)).result.current[0]).toBe("b");
  });

  it("pushes only with a syncKey", () => {
    const { push } = spy();
    const plain = renderHook(() => useStoredState("k", "a", allowed));
    act(() => plain.result.current[1]("b"));
    expect(push).not.toHaveBeenCalled();
    const synced = renderHook(() => useStoredState("k2", "a", allowed, "sync.k2"));
    act(() => synced.result.current[1]("b"));
    expect(push).toHaveBeenCalledWith("sync.k2", "b");
  });

  it("registered get/apply: reads storage, applies only allowed strings", () => {
    const { registered } = spy();
    const { result } = renderHook(() => useStoredState("k3", "a", allowed, "sync.k3"));
    const s = registered.find((r) => r.key === "sync.k3");
    expect(s?.get()).toBe("a");
    act(() => s?.apply("b"));
    expect(result.current[0]).toBe("b");
    act(() => s?.apply("nope"));
    act(() => s?.apply(42));
    expect(result.current[0]).toBe("b");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(s?.get()).toBeUndefined();
  });

  it("does not register without a syncKey", () => {
    const { reg } = spy();
    renderHook(() => useStoredState("k4", "a", allowed));
    expect(reg).not.toHaveBeenCalled();
  });
});
