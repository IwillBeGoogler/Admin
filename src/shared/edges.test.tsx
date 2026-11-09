import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { api, server } from "@/test/server";
import { createHttpClient } from "./http/client";
import { nextPageRequest, pageEnvelope } from "./http/envelope";
import { createTokenStore } from "./http/tokenStore";
import { I18nProvider } from "./i18n";
import { rfc3339ToLocalInput } from "./lib/format";
import { eventToken, isTypingTarget, keyLabels } from "./lib/useHotkeys";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

const setup = () => {
  const tokens = createTokenStore(null);
  tokens.set({ token: "t1", expiresAt: "2030-01-01T00:00:00Z" });
  const onSessionExpired = vi.fn();
  return { tokens, onSessionExpired, client: createHttpClient({ tokens, locale: () => "en", onSessionExpired }) };
};

describe("http client edges", () => {
  it("non-JSON error bodies fall back to the status message", async () => {
    server.use(http.get(api("/t"), () => new HttpResponse("gateway down", { status: 502 })));
    const err = await setup()
      .client("/t")
      .catch((e: unknown) => e);
    expect((err as Error).message).toBeTruthy();
  });

  it("an unparsable problem body still raises ApiError", async () => {
    server.use(http.get(api("/t"), () => HttpResponse.json({ status: "nope" }, { status: 400 })));
    const err = (await setup()
      .client("/t")
      .catch((e: unknown) => e)) as { status: number };
    expect(err.status).toBe(400);
  });

  it.each([
    ["no token in body", () => HttpResponse.json({ data: {} })],
    ["non-ok", () => HttpResponse.json({}, { status: 500 })],
    ["network error", () => HttpResponse.error()],
  ])("failed refresh (%s) expires the session", async (_n, refresh) => {
    server.use(
      http.get(api("/t"), () => HttpResponse.json({}, { status: 401 })),
      http.post(api("/auth/refresh"), refresh),
    );
    const { client, onSessionExpired, tokens } = setup();
    await client("/t").catch(() => {});
    expect(onSessionExpired).toHaveBeenCalled();
    expect(tokens.get()).toBeNull();
  });

  it("non-JSON refresh body is tolerated", async () => {
    server.use(
      http.get(api("/t"), () => HttpResponse.json({}, { status: 401 })),
      http.post(api("/auth/refresh"), () => new HttpResponse("plain", { status: 200 })),
    );
    const { client, onSessionExpired } = setup();
    await client("/t").catch(() => {});
    expect(onSessionExpired).toHaveBeenCalled();
  });
});

describe("envelope", () => {
  it("pageEnvelope defaults meta and null data", () => {
    const s = pageEnvelope(z.number());
    expect(s.parse({ data: [1, 2] }).meta).toEqual({
      page: 0,
      limit: 0,
      total: 2,
      hasMore: false,
      nextCursor: undefined,
    });
    expect(s.parse({ data: null }).items).toEqual([]);
    expect(s.parse({ data: [], meta: { next_cursor: "" } }).meta.nextCursor).toBeUndefined();
  });
  it("nextPageRequest: end, cursor, page", () => {
    const m = { page: 0, limit: 5, total: 9, hasMore: false, nextCursor: undefined };
    expect(nextPageRequest(m)).toBeUndefined();
    expect(nextPageRequest({ ...m, nextCursor: "c" }, 5)).toEqual({ cursor: "c", limit: 5 });
    expect(nextPageRequest({ ...m, hasMore: true }, 5)).toEqual({ page: 2, limit: 5 });
    expect(nextPageRequest({ ...m, hasMore: true, page: 3 })).toEqual({ page: 4, limit: undefined });
  });
});

describe("format and hotkey helpers", () => {
  it("rfc3339ToLocalInput rejects garbage", () => {
    expect(rfc3339ToLocalInput("garbage")).toBe("");
    expect(rfc3339ToLocalInput(null)).toBe("");
    expect(rfc3339ToLocalInput("2030-01-01T10:20:00Z")).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
  });

  it("isTypingTarget classifies elements", () => {
    const el = (html: string) => {
      const d = document.createElement("div");
      d.innerHTML = html;
      document.body.append(d);
      return d.firstElementChild as HTMLElement;
    };
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(el("<textarea></textarea>"))).toBe(true);
    expect(isTypingTarget(el("<select></select>"))).toBe(true);
    expect(isTypingTarget(el("<input type=text>"))).toBe(true);
    expect(isTypingTarget(el("<input type=checkbox>"))).toBe(false);
    expect(isTypingTarget(el("<button></button>"))).toBe(false);
    expect(isTypingTarget(el('<div contenteditable="true"><b id=x>t</b></div>').querySelector("b"))).toBe(true);
  });

  it("eventToken normalises keys and modifiers", () => {
    const k = (init: KeyboardEventInit) => eventToken(new KeyboardEvent("keydown", init));
    expect(k({ key: "Esc" })).toBe("escape");
    expect(k({ key: " " })).toBe("space");
    expect(k({ key: "k", ctrlKey: true })).toBe("mod+k");
    expect(k({ key: "k", metaKey: true, altKey: true, shiftKey: true })).toBe("mod+alt+shift+k");
    expect(k({ key: "?", shiftKey: true })).toBe("?");
  });

  it("keyLabels shows Apple or generic modifiers", () => {
    expect(keyLabels("mod+shift+k").flat().length).toBeGreaterThan(0);
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    expect(keyLabels("mod+alt+k")[0]).toEqual(["⌘", "⌥", "K"]);
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux");
    expect(keyLabels("mod+alt+escape")[0]).toEqual(["Ctrl", "Alt", "Esc"]);
  });
});

describe("DialogContent locked", () => {
  const open = (locked: boolean, extra: { onEscapeKeyDown?: () => void; onPointerDownOutside?: () => void } = {}) =>
    render(
      <I18nProvider initial="en">
        <Dialog open>
          <DialogContent locked={locked} {...extra}>
            <DialogTitle>T</DialogTitle>
            <DialogDescription>d</DialogDescription>
          </DialogContent>
        </Dialog>
      </I18nProvider>,
    );

  it("runs caller handlers for Escape and outside pointer", async () => {
    const esc = vi.fn();
    const out = vi.fn();
    open(false, { onEscapeKeyDown: esc, onPointerDownOutside: out });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(esc).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 20));
    await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body);
    expect(out).toHaveBeenCalled();
  });

  it("locked keeps it open and still reports", async () => {
    const esc = vi.fn();
    const out = vi.fn();
    open(true, { onEscapeKeyDown: esc, onPointerDownOutside: out });
    fireEvent.keyDown(document, { key: "Escape" });
    await new Promise((r) => setTimeout(r, 20));
    await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body);
    expect(esc).toHaveBeenCalled();
    expect(out).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
  });
});

describe("token store default storage", () => {
  it("falls back to memory when sessionStorage access throws", () => {
    const spy = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      const s = createTokenStore();
      s.set({ token: "a", expiresAt: "b" });
      expect(s.get()?.token).toBe("a");
    } finally {
      spy.mockRestore();
    }
  });
});
