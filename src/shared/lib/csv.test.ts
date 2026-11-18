import { describe, expect, it, vi } from "vitest";
import { downloadText, toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes, escapes and guards formulas", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["=1+1", 5],
          ['x,"y"', "line\nbreak"],
          [-3, "@h"],
        ],
      ),
    ).toBe('a,b\r\n\'=1+1,5\r\n"x,""y""","line\nbreak"\r\n-3,\'@h');
  });
});

describe("downloadText", () => {
  it("clicks a temporary link", () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadText("f.csv", "a");
    downloadText("f.txt", "a", "text/plain");
    expect(click).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:x");
    click.mockRestore();
  });
});
