import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderUI } from "@/test/render";
import { onSessionExpired } from "./api";
import { ApiError, ContractError, errorMessage, isApiError } from "./http/problem";
import { createTokenStore } from "./http/tokenStore";
import { currentLocale, detectLocale, I18nProvider, translate, useI18n } from "./i18n";
import { notifyError, notifySuccess, notifyWarning } from "./lib/notify";
import { compareValues } from "./lib/sort";
import { useSearchText } from "./lib/useSearchText";
import { useStoredState } from "./lib/useStoredState";
import { ConfirmDialog } from "./ui/dialog";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownTrigger,
} from "./ui/dropdown";
import { LoadMore } from "./ui/load-more";
import { RelativeTime } from "./ui/relative-time";
import { SearchInput } from "./ui/search-input";
import { EmptyState, ErrorState, LoadingRows, OfflineBanner } from "./ui/states";
import { ThemeProvider, useTheme } from "./ui/theme";

afterEach(() => vi.restoreAllMocks());

describe("problem", () => {
  it("errorMessage covers api, plain and non-error values", () => {
    const a = new ApiError(500, { detail: "boom", request_id: "r1" });
    expect(isApiError(a)).toBe(true);
    expect(errorMessage(a)).toContain("r1");
    expect(errorMessage(new ApiError(500, { detail: "boom" }))).toBe("boom");
    expect(errorMessage(new Error("plain"))).toBe("plain");
    expect(errorMessage(42)).toBe("42");
    expect(new ContractError("/p", []).message).toContain("/p");
    expect(new ApiError(409, {}).isConflict).toBe(true);
    expect(new ApiError(401, {}).isUnauthorized).toBe(true);
    expect(new ApiError(403, {}).isForbidden).toBe(true);
    expect(new ApiError(404, {}).isNotFound).toBe(true);
  });
});

describe("tokenStore", () => {
  it("notifies listeners, unsubscribes, and survives storage errors", () => {
    const boom = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
      removeItem: () => {
        throw new Error("x");
      },
    };
    const s = createTokenStore(boom);
    expect(s.get()).toBeNull();
    const l = vi.fn();
    const off = s.subscribe(l);
    s.set({ token: "a", expiresAt: "b" });
    expect(l).toHaveBeenCalledOnce();
    off();
    s.set(null);
    expect(l).toHaveBeenCalledOnce();
  });

  it("rejects malformed stored values", () => {
    const mk = (raw: string | null) => createTokenStore({ getItem: () => raw, setItem() {}, removeItem() {} });
    expect(mk(null).get()).toBeNull();
    expect(mk("{bad").get()).toBeNull();
    expect(mk('{"token":1}').get()).toBeNull();
    expect(mk('{"token":"a","expiresAt":"b"}').get()).toEqual({ token: "a", expiresAt: "b" });
  });

  it("works with null storage", () => {
    const s = createTokenStore(null);
    s.set({ token: "a", expiresAt: "b" });
    expect(s.get()?.token).toBe("a");
  });
});

describe("api index", () => {
  it("onSessionExpired returns an unsubscribe", () => {
    const off = onSessionExpired(() => {});
    expect(typeof off).toBe("function");
    off();
  });
});

describe("i18n", () => {
  it("detectLocale prefers storage, then navigator, then uz", () => {
    localStorage.setItem("admin.locale", "ru");
    expect(detectLocale()).toBe("ru");
    localStorage.clear();
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    expect(detectLocale()).toBe("en");
    vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
    expect(detectLocale()).toBe("uz");
  });

  it("detectLocale ignores broken storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("x");
    });
    expect(["en", "ru", "uz"]).toContain(detectLocale());
  });

  it("translate falls back to en then key and fills vars", () => {
    expect(translate("en", "common.total", { n: 3 })).toContain("3");
    expect(translate("en", "common.total")).toContain("{n}");
    expect(translate("en", "no.such.key" as never)).toBe("no.such.key");
    expect(translate("en", "common" as never)).toBe("common");
  });

  it("provider sets lang, persists and switches; hook throws outside", async () => {
    const Probe = () => {
      const { locale, setLocale } = useI18n();
      return (
        <button type="button" onClick={() => setLocale("ru")}>
          {locale}
        </button>
      );
    };
    render(
      <I18nProvider initial="en">
        <Probe />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "en" }));
    expect(await screen.findByRole("button", { name: "ru" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ru");
    expect(currentLocale()).toBe("ru");
    expect(localStorage.getItem("admin.locale")).toBe("ru");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useI18n outside I18nProvider");
    render(
      <I18nProvider initial="en">
        <span />
      </I18nProvider>,
    );
  });

  it("provider tolerates failing storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("x");
    });
    render(
      <I18nProvider initial="en">
        <span>ok</span>
      </I18nProvider>,
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});

describe("compareValues", () => {
  it("orders by type with empties last", () => {
    expect(compareValues(null, 1)).toBe(1);
    expect(compareValues(1, "")).toBe(-1);
    expect(compareValues(undefined, null)).toBe(0);
    expect(compareValues(1, 3)).toBeLessThan(0);
    expect(compareValues(true, false)).toBeGreaterThan(0);
    expect(compareValues(["a"], ["b"])).toBeLessThan(0);
    expect(compareValues("a2", "a10")).toBeLessThan(0);
  });
});

describe("notify", () => {
  it("routes to sonner with the policy", () => {
    const s = vi.spyOn(toast, "success").mockReturnValue(1);
    const e = vi.spyOn(toast, "error").mockReturnValue(1);
    const w = vi.spyOn(toast, "warning").mockReturnValue(1);
    notifySuccess("ok");
    expect(s).toHaveBeenCalledWith("ok", { duration: 4000 });
    notifyError(new Error("bad"));
    expect(e).toHaveBeenLastCalledWith("bad", { duration: Number.POSITIVE_INFINITY });
    const onClick = vi.fn();
    notifyError("x", { label: "Retry", onClick });
    expect(e).toHaveBeenLastCalledWith("x", {
      duration: Number.POSITIVE_INFINITY,
      action: { label: "Retry", onClick },
    });
    notifyWarning("careful");
    expect(w).toHaveBeenCalledWith("careful", { duration: Number.POSITIVE_INFINITY });
  });
});

describe("useSearchText", () => {
  it("debounces, trims, syncs outside changes, skips unchanged", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const { result, rerender } = renderHook(({ v }) => useSearchText(v, commit, 100), {
      initialProps: { v: undefined as string | undefined },
    });
    act(() => result.current[1]("  hi "));
    act(() => result.current[1]("  hello "));
    expect(commit).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(100));
    expect(commit).toHaveBeenCalledExactlyOnceWith("hello");
    rerender({ v: "ext" });
    expect(result.current[0]).toBe("ext");
    rerender({ v: undefined });
    expect(result.current[0]).toBe("");
    act(() => result.current[1]("   "));
    act(() => void vi.advanceTimersByTime(100));
    expect(commit).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe("useStoredState", () => {
  it("reads allowed values, falls back, persists, and tolerates storage errors", () => {
    localStorage.setItem("k", "b");
    const { result } = renderHook(() => useStoredState("k", "a", ["a", "b", "c"] as const));
    expect(result.current[0]).toBe("b");
    act(() => result.current[1]("c"));
    expect(localStorage.getItem("k")).toBe("c");
    localStorage.setItem("k", "zzz");
    expect(renderHook(() => useStoredState("k", "a", ["a", "b"] as const)).result.current[0]).toBe("a");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("x");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("x");
    });
    expect(renderHook(() => useStoredState("k", "a", ["a", "b"] as const)).result.current[0]).toBe("a");
  });
});

describe("ThemeProvider", () => {
  const Probe = () => {
    const { theme, setTheme } = useTheme();
    return (
      <>
        <span>{theme}</span>
        <button type="button" onClick={() => setTheme("dark")}>
          dark
        </button>
        <button type="button" onClick={() => setTheme("system")}>
          system
        </button>
      </>
    );
  };
  it("applies, persists and clears the stored theme", async () => {
    localStorage.setItem("admin.theme", "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText("light")).toBeInTheDocument();
    await userEvent.click(screen.getByText("dark", { selector: "button" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("admin.theme")).toBe("dark");
    await userEvent.click(screen.getByText("system", { selector: "button" }));
    expect(localStorage.getItem("admin.theme")).toBeNull();
  });
  it("falls back to system on storage errors; hook throws outside", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("x");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("x");
    });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText("system", { selector: "span" })).toBeInTheDocument();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useTheme outside ThemeProvider");
  });
});

describe("ui bits", () => {
  it("RelativeTime renders a dash for empty or invalid values", () => {
    renderUI(
      <>
        <RelativeTime value={null} />
        <RelativeTime value="not a date" />
        <RelativeTime value="2030-01-01T00:00:00Z" />
      </>,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2030-01-01T00:00:00Z");
  });

  it("SearchInput clears on Escape only when it has text and via button", async () => {
    const change = vi.fn();
    const { user, rerender } = renderUI(<SearchInput value="abc" onValueChange={change} aria-label="s" />);
    await user.type(screen.getByLabelText("s"), "{Escape}");
    expect(change).toHaveBeenCalledWith("");
    change.mockClear();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(change).toHaveBeenCalledWith("");
    expect(screen.getByLabelText("s")).toHaveFocus();
    change.mockClear();
    rerender(
      <I18nProvider initial="en">
        <SearchInput value="" onValueChange={change} aria-label="s" />
      </I18nProvider>,
    );
    fireEvent.keyDown(screen.getByLabelText("s"), { key: "Escape" });
    expect(change).not.toHaveBeenCalled();
  });

  it("states: empty, error (forbidden, retry), loading, offline banner", async () => {
    const retry = vi.fn();
    const { user } = renderUI(
      <>
        <EmptyState title="Nothing" hint="hint" action={<button type="button">act</button>} />
        <ErrorState error={new Error("bad")} onRetry={retry} />
        <ErrorState error={new ApiError(403, {})} onRetry={retry} />
        <LoadingRows rows={2} label="Wait" />
        <OfflineBanner />
      </>,
    );
    expect(screen.getByText("hint")).toBeInTheDocument();
    expect(screen.getByText("Wait")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status", { name: /offline/i })).toBeNull();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(await screen.findByText(/offline/i)).toBeInTheDocument();
  });

  it("LoadMore shows progress, button when more, disabled while loading", () => {
    const more = vi.fn();
    const { rerender } = renderUI(<LoadMore shown={5} total={3} hasNext loading={false} onMore={more} />);
    fireEvent.click(screen.getByRole("button"));
    expect(more).toHaveBeenCalledOnce();
    rerender(
      <I18nProvider initial="en">
        <LoadMore shown={5} total={9} hasNext loading onMore={more} />
      </I18nProvider>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(
      <I18nProvider initial="en">
        <LoadMore shown={5} total={5} hasNext={false} loading={false} onMore={more} />
      </I18nProvider>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("dropdown items and radio items render", async () => {
    const { user } = renderUI(
      <Dropdown>
        <DropdownTrigger>menu</DropdownTrigger>
        <DropdownContent>
          <DropdownItem>One</DropdownItem>
          <DropdownRadioGroup value="a">
            <DropdownRadioItem value="a">Alpha</DropdownRadioItem>
          </DropdownRadioGroup>
        </DropdownContent>
      </Dropdown>,
    );
    await user.click(screen.getByText("menu"));
    expect(await screen.findByRole("menuitem", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /Alpha/ })).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  const setup = (over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    const r = renderUI(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        {...over}
      />,
    );
    return { ...r, onOpenChange, onConfirm };
  };

  it("sync confirm does not close by itself; Escape closes", async () => {
    const { user, onConfirm, onOpenChange } = setup({ description: "desc" });
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("async confirm closes on success", async () => {
    const { user, onOpenChange } = setup({ onConfirm: () => Promise.resolve() });
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("failure stays open, toasts and shows no close while in flight; Escape blocked while pending", async () => {
    const err = vi.spyOn(toast, "error").mockReturnValue(1);
    let rej: (e: unknown) => void = () => {};
    const { user, onOpenChange } = setup({
      onConfirm: () =>
        new Promise((_, r) => {
          rej = r;
        }),
    });
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => rej(new Error("nope")));
    await waitFor(() => expect(err).toHaveBeenCalled());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("typed confirmation gates the button and Enter submits", async () => {
    const { user, onConfirm } = setup({ confirmText: "DELETE" });
    const input = screen.getByRole("textbox");
    const btn = screen.getByRole("button", { name: "Yes" });
    expect(btn).toBeDisabled();
    await user.type(input, "DELETE{Enter}");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("external pending prop blocks run", async () => {
    const { onConfirm } = setup({ pending: true });
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
