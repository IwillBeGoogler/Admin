import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/contexts/analytics";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/")({
  component: () => (
    <RequirePermission anyOf={["stats.read"]}>
      <DashboardPage />
    </RequirePermission>
  ),
});
