import { describe, expect, it } from "vitest";
import { feedbackSchema, feedbackSearchSchema } from "./feedback";

describe("feedback", () => {
  it("fills anonymous senders", () => {
    const f = feedbackSchema.parse({ id: 1, kind: "bug", message: "m", status: "open", created_at: "x" });
    expect(f).toMatchObject({ user_id: 0, username: "", contact_email: "", error_stack: "" });
  });
  it("search falls back to open / all", () => {
    expect(feedbackSearchSchema.parse({})).toEqual({ status: "open", kind: "all" });
    expect(feedbackSearchSchema.parse({ status: "x", kind: "y" })).toEqual({ status: "open", kind: "all" });
    expect(feedbackSearchSchema.parse({ status: "resolved", kind: "idea" })).toEqual({
      status: "resolved",
      kind: "idea",
    });
  });
});
