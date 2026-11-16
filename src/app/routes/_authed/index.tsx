import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DashboardPage } from "@/contexts/analytics";
import { RequirePermission, usePermissions } from "@/contexts/identity";
import { visibleNavigation } from "../../nav";

/** The dashboard needs stats.read; anyone else lands on the first page they may open. */
function Home() {
  const { can, canAny } = usePermissions();
  if (!can("stats.read")) {
    const first = visibleNavigation(canAny)
      .flatMap((g) => g.items)
      .find((i) => i.to !== "/");
    if (first) return <Navigate to={first.to} replace />;
  }
  return (
    <RequirePermission anyOf={["stats.read"]}>
      <DashboardPage />
    </RequirePermission>
  );
}

export const Route = createFileRoute("/_authed/")({ component: Home });
