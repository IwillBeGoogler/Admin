import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/contexts/identity";
import { ReportsPage, reportsSearchSchema } from "@/contexts/moderation";

export const Route = createFileRoute("/_authed/reports")({ validateSearch: reportsSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["report.moderate"]}>
      <ReportsPage search={search} onSearchChange={(s) => void navigate({ search: s })} />
    </RequirePermission>
  );
}
