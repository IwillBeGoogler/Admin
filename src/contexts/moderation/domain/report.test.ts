import { describe, expect, it } from "vitest";
import { canDecide, canRemoveContent, decisionPayload, reportSchema, reportsSearchSchema } from "./report";

const base = {
  id: 1,
  reporter_id: 2,
  reporter: "ali",
  target_type: "post",
  target_id: 4,
  reason: "spam",
  note: "",
  status: "open",
  resolved_by: 0,
  created_at: "2030-01-01T00:00:00Z",
  reports: 2,
};

describe("report rules", () => {
  it("parses the API shape", () => {
    expect(reportSchema.parse(base).reports).toBe(2);
  });
  it("only open reports can be decided", () => {
    expect(canDecide(reportSchema.parse(base))).toBe(true);
    expect(canDecide(reportSchema.parse({ ...base, status: "resolved" }))).toBe(false);
  });
  it("content removal only for posts and comments when resolving", () => {
    const post = reportSchema.parse(base);
    const user = reportSchema.parse({ ...base, target_type: "user" });
    expect(canRemoveContent(post, "resolved")).toBe(true);
    expect(canRemoveContent(post, "dismissed")).toBe(false);
    expect(canRemoveContent(user, "resolved")).toBe(false);
  });
  it("builds the decision body, never removing on dismiss", () => {
    const post = reportSchema.parse(base);
    expect(decisionPayload(post, "resolved", true)).toEqual({ status: "resolved", remove_content: true });
    expect(decisionPayload(post, "dismissed", true)).toEqual({ status: "dismissed", remove_content: false });
  });
  it("search: status defaults to open, invalid falls back", () => {
    expect(reportsSearchSchema.parse({})).toEqual({ status: "open" });
    expect(reportsSearchSchema.parse({ status: "bogus" })).toEqual({ status: "open" });
    expect(reportsSearchSchema.parse({ status: "all" })).toEqual({ status: "all" });
  });
  it("accepts diagram targets addressed by file id", () => {
    const d = reportSchema.parse({ ...base, target_type: "diagram", target_id: undefined, target_file_id: "f_1" });
    expect(d.target_id).toBe(0);
    expect(d.target_file_id).toBe("f_1");
    expect(canRemoveContent(d, "resolved")).toBe(true);
    expect(canRemoveContent(d, "dismissed")).toBe(false);
  });
});
