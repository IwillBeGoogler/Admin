import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/http";
import { shouldRetry } from "./queryClient";

describe("retry policy", () => {
  it("does not retry client errors except 429", () => {
    expect(shouldRetry(0, new ApiError(404))).toBe(false);
    expect(shouldRetry(0, new ApiError(403))).toBe(false);
    expect(shouldRetry(0, new ApiError(429))).toBe(true);
  });
  it("retries network and 5xx twice", () => {
    expect(shouldRetry(0, new TypeError("fetch failed"))).toBe(true);
    expect(shouldRetry(1, new ApiError(503))).toBe(true);
    expect(shouldRetry(2, new ApiError(503))).toBe(false);
  });
});
