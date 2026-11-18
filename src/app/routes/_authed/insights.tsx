import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage, insightsSearchSchema } from "@/contexts/analytics";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/insights")({ validateSearch: insightsSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["stats.read"]}>
      <InsightsPage search={search} onSearchChange={(s) => void navigate({ search: s })} />
    </RequirePermission>
  );
}
