import { createFileRoute } from "@tanstack/react-router";
import { PermissionsPage } from "@/contexts/access";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/permissions")({
  component: () => (
    <RequirePermission anyOf={["permission.read"]}>
      <PermissionsPage />
    </RequirePermission>
  ),
});
