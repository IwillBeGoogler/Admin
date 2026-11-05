import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "@/contexts/access";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/sessions/")({
  component: () => (
    <RequirePermission anyOf={[]}>
      <SessionsPage />
    </RequirePermission>
  ),
});
