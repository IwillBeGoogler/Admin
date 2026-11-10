import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSidebar } from "./useSidebar";

describe("useSidebar", () => {
  beforeEach(() => localStorage.clear());

  it("starts expanded and toggles to collapsed and back, persisting", () => {
    const { result } = renderHook(() => useSidebar());
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem("admin.sidebar")).toBe("collapsed");
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem("admin.sidebar")).toBe("expanded");
  });

  it("restores a stored collapsed state", () => {
    localStorage.setItem("admin.sidebar", "collapsed");
    const { result } = renderHook(() => useSidebar());
    expect(result.current.collapsed).toBe(true);
  });
});
