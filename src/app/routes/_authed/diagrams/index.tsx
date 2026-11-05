import { createFileRoute } from "@tanstack/react-router";
import { DiagramsPage, projectsSearchSchema } from "@/contexts/diagrams";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/diagrams/")({ validateSearch: projectsSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["diagrams.read", "diagrams.manage"]}>
      <DiagramsPage search={search} onSearchChange={(s, o) => void navigate({ search: s, replace: o?.replace })} />
    </RequirePermission>
  );
}
