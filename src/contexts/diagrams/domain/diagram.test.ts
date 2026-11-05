import { describe, expect, it } from "vitest";
import {
  byPosition,
  formatBytes,
  isShareActive,
  nextPosition,
  projectDetailSchema,
  type Template,
  templateInputSchema,
} from "./diagram";

const tpl = (o: Partial<Template>): Template => ({
  id: "1",
  title: "t",
  kind: "system",
  description: "",
  file_id: "f",
  published: true,
  position: 0,
  ...o,
});

describe("diagram domain", () => {
  it("formats bytes", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 ** 3, "en")).toBe("5 GB");
    expect(formatBytes(-4, "en")).toBe("0 B");
  });
  it("orders templates and picks the next position", () => {
    const all = [
      tpl({ id: "a", title: "b", position: 2 }),
      tpl({ id: "b", title: "a", position: 2 }),
      tpl({ position: 1 }),
    ];
    expect([...all].sort(byPosition).map((t) => t.id)).toEqual(["1", "b", "a"]);
    expect(nextPosition(all)).toBe(3);
    expect(nextPosition([])).toBe(1);
  });
  it("tells active share links apart", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    const base = { id: "s", role: "viewer", created_by: "", created_at: "2029-01-01T00:00:00Z" };
    expect(isShareActive(base, now)).toBe(true);
    expect(isShareActive({ ...base, revoked_at: "2029-06-01T00:00:00Z" }, now)).toBe(false);
    expect(isShareActive({ ...base, expires_at: "2029-06-01T00:00:00Z" }, now)).toBe(false);
    expect(isShareActive({ ...base, expires_at: "2031-01-01T00:00:00Z" }, now)).toBe(true);
  });
  it("validates template input with i18n keys", () => {
    const bad = templateInputSchema.safeParse({
      title: " ",
      kind: "db",
      description: "",
      file_id: "",
      published: false,
    });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => i.message)).toEqual(["auth.required", "auth.required"]);
    expect(
      templateInputSchema.safeParse({ title: "A", kind: "ood", description: "", file_id: "f1", published: true })
        .success,
    ).toBe(true);
  });
  it("treats null lists and numeric ids leniently", () => {
    const p = projectDetailSchema.parse({
      id: 5,
      name: "n",
      owner: { id: 2, username: "ali" },
      updated_at: "2030-01-01T00:00:00Z",
      files: null,
      members: null,
    });
    expect(p.id).toBe("5");
    expect(p.owner.id).toBe("2");
    expect(p.files).toEqual([]);
    expect(p.shares).toEqual([]);
    expect(p.shared).toBe(false);
  });
});
