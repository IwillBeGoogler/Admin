import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/contexts/identity";
import { ClientErrorsPage, clientErrorsSearchSchema } from "@/contexts/moderation";

export const Route = createFileRoute("/_authed/client-errors")({
  validateSearch: clientErrorsSearchSchema,
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["report.moderate"]}>
      <ClientErrorsPage search={search} onSearchChange={(s) => void navigate({ search: s })} />
    </RequirePermission>
  );
}
