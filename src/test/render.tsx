import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { Toaster } from "sonner";
import { I18nProvider } from "@/shared/i18n";

export const testQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY }, mutations: { retry: false } },
  });

/** Render with Query + i18n (en). Returns user-event too. */
export function renderUI(ui: ReactElement, qc = testQueryClient()) {
  const user = userEvent.setup();
  const r = render(
    <QueryClientProvider client={qc}>
      <I18nProvider initial="en">
        {ui}
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return { ...r, user, qc };
}

/**
 * Render inside a memory router so Link and useNavigate work. Every path
 * renders `ui`; `router.state.location` tells where a navigation went.
 */
export async function renderRouted(ui: ReactElement, { path = "/", qc = testQueryClient() } = {}) {
  const user = userEvent.setup();
  const root = createRootRoute();
  const page = createRoute({ getParentRoute: () => root, path: "$", component: () => ui });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => ui });
  const router = createRouter({
    routeTree: root.addChildren([index, page]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const r = render(
    <QueryClientProvider client={qc}>
      <I18nProvider initial="en">
        <RouterProvider router={router} />
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  );
  await router.load();
  return { ...r, user, qc, router, screen };
}
