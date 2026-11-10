import { describe, expect, it } from "vitest";
import { codeGroupSnippet, insertCodeGroup } from "./codeGroup";

describe("insertCodeGroup", () => {
  it("writes adjacent fences that share a group", () => {
    expect(codeGroupSnippet("g1")).toBe("```javascript group=g1\n\n```\n\n```python group=g1\n\n```\n");
  });
  it("starts on its own line and puts the caret inside the first block", () => {
    const r = insertCodeGroup("Intro", 5, "g1");
    expect(r.body.startsWith("Intro\n\n```javascript group=g1\n\n```")).toBe(true);
    expect(r.body.slice(0, r.caret).endsWith("group=g1\n")).toBe(true);
    expect(insertCodeGroup("", 0, "g1").body.startsWith("```javascript")).toBe(true);
    expect(insertCodeGroup("a\n\n", 3, "g1").body.startsWith("a\n\n```javascript")).toBe(true);
  });
  it("keeps the text after the caret on its own line", () => {
    const r = insertCodeGroup("ab", 1, "g1");
    expect(r.body.endsWith("```\n\nb")).toBe(true);
  });
});
