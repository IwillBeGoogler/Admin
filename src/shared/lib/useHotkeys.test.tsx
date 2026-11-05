import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eventToken, type Hotkeys, keyLabels, useHotkeys } from "./useHotkeys";

function Harness({ keys, enabled = true }: { keys: Hotkeys; enabled?: boolean }) {
  useHotkeys(keys, enabled);
  return (
    <div>
      <input aria-label="field" />
      <input type="checkbox" aria-label="box" />
    </div>
  );
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element | Document = document) =>
  fireEvent.keyDown(target, { key, ...init });

describe("useHotkeys", () => {
  afterEach(() => vi.useRealTimers());

  it("normalises tokens", () => {
    expect(eventToken(new KeyboardEvent("keydown", { key: "K", ctrlKey: true }))).toBe("mod+k");
    expect(eventToken(new KeyboardEvent("keydown", { key: "k", metaKey: true }))).toBe("mod+k");
    expect(eventToken(new KeyboardEvent("keydown", { key: "?", shiftKey: true }))).toBe("?");
    expect(eventToken(new KeyboardEvent("keydown", { key: "J", shiftKey: true }))).toBe("shift+j");
    expect(eventToken(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("escape");
  });

  it("fires single keys and ignores them while typing", () => {
    const j = vi.fn();
    const { getByLabelText } = render(<Harness keys={{ j }} />);
    press("j");
    expect(j).toHaveBeenCalledTimes(1);
    press("j", {}, getByLabelText("field"));
    expect(j).toHaveBeenCalledTimes(1);
    press("j", {}, getByLabelText("box"));
    expect(j).toHaveBeenCalledTimes(2);
  });

  it("allowInInput bindings fire inside inputs", () => {
    const save = vi.fn();
    const { getByLabelText } = render(<Harness keys={{ "mod+s": { allowInInput: true, handler: save } }} />);
    press("s", { ctrlKey: true }, getByLabelText("field"));
    expect(save).toHaveBeenCalledOnce();
  });

  it("runs two-key sequences within one second only", () => {
    vi.useFakeTimers();
    const go = vi.fn();
    render(<Harness keys={{ "g r": go }} />);
    press("g");
    press("r");
    expect(go).toHaveBeenCalledOnce();
    press("g");
    vi.advanceTimersByTime(1100);
    press("r");
    expect(go).toHaveBeenCalledOnce();
  });

  it("typing g in a search box starts no sequence", () => {
    const go = vi.fn();
    const { getByLabelText } = render(<Harness keys={{ "g r": go }} />);
    const field = getByLabelText("field");
    press("g", {}, field);
    press("r", {}, field);
    press("r");
    expect(go).not.toHaveBeenCalled();
  });

  it("is silent while a dialog is open unless allowed", () => {
    const j = vi.fn();
    const k = vi.fn();
    render(
      <>
        <Harness keys={{ j, k: { allowInDialog: true, handler: k } }} />
        <div role="dialog" data-state="open" />
      </>,
    );
    press("j");
    press("k");
    expect(j).not.toHaveBeenCalled();
    expect(k).toHaveBeenCalledOnce();
  });

  it("later layers win and disabled hooks do nothing", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const off = vi.fn();
    render(
      <>
        <Harness keys={{ x: outer }} />
        <Harness keys={{ x: inner }} />
        <Harness keys={{ y: off }} enabled={false} />
      </>,
    );
    press("x");
    press("y");
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
    expect(off).not.toHaveBeenCalled();
  });

  it("labels keys for display", () => {
    expect(keyLabels("g d")).toEqual([["G"], ["D"]]);
    expect(keyLabels("escape")).toEqual([["Esc"]]);
  });
});
