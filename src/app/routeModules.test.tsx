import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { signIn } from "@/test/fixtures";
import { api, server } from "@/test/server";
import { Providers } from "./providers";
import { createQueryClient } from "./queryClient";
import { routeTree } from "./routeTree.gen";

const empty = { data: [], meta: { page: 1, limit: 20, total: 0, has_more: false } };

async function mount(path: string) {
  localStorage.setItem("admin.locale", "en");
  signIn();
  server.use(
    http.get(api("/*"), ({ request }) => {
      const p = new URL(request.url).pathname;
      if (p.endsWith("/me") || p.endsWith("/guard/auth/me")) return undefined;
      return HttpResponse.json(empty);
    }),
  );
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  await waitFor(() => expect(router.state.status).toBe("idle"));
  return router;
}

const ids: [string, string][] = [
  ["/", "/_authed/"],
  ["/categories", "/_authed/categories"],
  ["/labels", "/_authed/labels"],
  ["/tags", "/_authed/tags"],
  ["/permissions", "/_authed/permissions"],
  ["/roles", "/_authed/roles/"],
  ["/sessions", "/_authed/sessions/"],
  ["/audit", "/_authed/audit"],
  ["/bans", "/_authed/bans"],
  ["/client-errors", "/_authed/client-errors"],
  ["/comments", "/_authed/comments"],
  ["/diagram-templates", "/_authed/diagram-templates"],
  ["/feedback", "/_authed/feedback"],
  ["/policies", "/_authed/policies"],
  ["/reports", "/_authed/reports"],
  ["/users", "/_authed/users"],
  ["/diagrams", "/_authed/diagrams/"],
  ["/diagrams/p1", "/_authed/diagrams/$projectId"],
  ["/posts", "/_authed/posts/"],
  ["/posts/new", "/_authed/posts/new"],
  ["/roles/editor", "/_authed/roles/$name"],
  ["/sessions/abc", "/_authed/sessions/$id"],
  ["/sessions/abc?user=5", "/_authed/sessions/$id"],
];

describe("route modules", () => {
  it.each(ids)("renders %s", async (path, id) => {
    const router = await mount(path);
    expect(router.state.matches.at(-1)?.routeId).toBe(id);
  });

  it.each(["/comments", "/users", "/diagrams", "/posts"])("search change on %s updates the URL", async (path) => {
    const router = await mount(path);
    const box = await screen.findAllByRole("searchbox");
    await userEvent.type(box[0] as HTMLElement, "zzz");
    await waitFor(() => expect(router.state.location.searchStr).toContain("zzz"));
  });

  it.each(["/reports", "/client-errors", "/feedback"])("filter button on %s updates the URL", async (path) => {
    const router = await mount(path);
    const btns = await screen.findAllByRole("button", { pressed: false });
    await userEvent.click(btns[0] as HTMLElement);
    await waitFor(() => expect(router.state.location.searchStr).not.toBe(""));
  });

  it("audit limit select updates the URL", async () => {
    const router = await mount("/audit");
    await userEvent.selectOptions(await screen.findByLabelText("Rows"), "100");
    await waitFor(() => expect(router.state.location.searchStr).toContain("100"));
  });

  it("bans kind select updates the URL", async () => {
    const router = await mount("/bans");
    await screen.findAllByRole("combobox");
    const sel = document.getElementById("bans-kind") as HTMLSelectElement;
    await userEvent.selectOptions(sel, (sel.querySelectorAll("option")[1] as HTMLOptionElement).value);
    await waitFor(() => expect(router.state.location.searchStr).not.toBe(""));
  });

  it("unknown path shows 404", async () => {
    const router = await mount("/nope");
    await waitFor(() => expect(document.body.textContent).toContain("404"));
    expect(router.state.status).toBe("idle");
  });

  it("invalid post id shows 404", async () => {
    await mount("/posts/abc");
    await waitFor(() => expect(document.body.textContent).toContain("404"));
  });
});
