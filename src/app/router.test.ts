import { describe, expect, it } from "vitest";
import { createQueryClient } from "./queryClient";
import { createAppRouter } from "./router";

describe("createAppRouter", () => {
  it("wires context and preload defaults", () => {
    const queryClient = createQueryClient();
    const router = createAppRouter(queryClient);
    expect(router.options.context.queryClient).toBe(queryClient);
    expect(router.options.defaultPreload).toBe("intent");
    expect(router.options.scrollRestoration).toBe(true);
  });
});
