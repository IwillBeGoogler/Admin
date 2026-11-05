import { describe, expect, it } from "vitest";
import { compareValues, nextSort, parseSort, serializeSort, sortRows } from "./sort";

describe("sort", () => {
  it("parses and serializes the URL form", () => {
    expect(parseSort("title")).toEqual({ id: "title", desc: false });
    expect(parseSort("-views")).toEqual({ id: "views", desc: true });
    expect(parseSort("")).toBeUndefined();
    expect(parseSort("-")).toBeUndefined();
    expect(serializeSort({ id: "views", desc: true })).toBe("-views");
    expect(serializeSort(undefined)).toBeUndefined();
  });
  it("cycles none -> asc -> desc -> none", () => {
    expect(nextSort(undefined, "a")).toEqual({ id: "a", desc: false });
    expect(nextSort({ id: "a", desc: false }, "a")).toEqual({ id: "a", desc: true });
    expect(nextSort({ id: "a", desc: true }, "a")).toBeUndefined();
    expect(nextSort({ id: "b", desc: true }, "a")).toEqual({ id: "a", desc: false });
  });
  it("compares numbers, numeric strings and booleans", () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues("item 2", "item 10")).toBeLessThan(0);
    expect(compareValues(false, true)).toBeLessThan(0);
  });
  it("sorts stably and keeps empty values last in both directions", () => {
    const rows = [{ v: 2 }, { v: null }, { v: 1 }, { v: 2 }];
    const get = (r: { v: number | null }) => r.v;
    expect(sortRows(rows, { id: "v", desc: false }, get).map(get)).toEqual([1, 2, 2, null]);
    expect(sortRows(rows, { id: "v", desc: true }, get).map(get)).toEqual([2, 2, 1, null]);
    const desc = sortRows(rows, { id: "v", desc: true }, get);
    expect(desc[0]).toBe(rows[0]);
    expect(sortRows(rows, undefined, get)).toEqual(rows);
  });
});
