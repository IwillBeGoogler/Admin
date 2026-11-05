import { describe, expect, it } from "vitest";
import { visibleNavigation } from "./nav";

describe("permission-based navigation", () => {
  it("shows only what a moderator may use", () => {
    const perms = new Set(["report.moderate", "comment.moderate"]);
    const nav = visibleNavigation((codes) => codes.length === 0 || codes.some((c) => perms.has(c)));
    const items = nav.flatMap((g) => g.items.map((i) => i.to));
    expect(items).toEqual(["/tags", "/reports", "/feedback", "/client-errors", "/comments", "/sessions"]);
    expect(nav.map((g) => g.label)).toEqual(["nav.content", "nav.moderation", "nav.access"]);
  });
  it("super admin sees all", () => {
    expect(visibleNavigation(() => true).flatMap((g) => g.items)).toHaveLength(18);
  });
  it("gates diagram pages on their own permissions", () => {
    const only = (...p: string[]) => {
      const set = new Set(p);
      return visibleNavigation((codes) => codes.length === 0 || codes.some((c) => set.has(c)))
        .filter((g) => g.label === "nav.diagrams")
        .flatMap((g) => g.items.map((i) => i.to));
    };
    expect(only("diagrams.read")).toEqual(["/diagrams"]);
    expect(only("templates.manage")).toEqual(["/diagram-templates"]);
    expect(only("diagrams.manage", "templates.manage")).toEqual(["/diagrams", "/diagram-templates"]);
    expect(only("post.create")).toEqual([]);
  });
});
