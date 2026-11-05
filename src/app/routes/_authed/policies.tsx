import { createFileRoute } from "@tanstack/react-router";
import { PoliciesPage } from "@/contexts/access";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/policies")({
  component: () => (
    <RequirePermission anyOf={["policy.read"]}>
      <PoliciesPage />
    </RequirePermission>
  ),
});
