import { createFileRoute } from "@tanstack/react-router";
import { RolesPage } from "@/contexts/access";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/roles/")({
  component: () => (
    <RequirePermission anyOf={["role.read"]}>
      <RolesPage />
    </RequirePermission>
  ),
});
