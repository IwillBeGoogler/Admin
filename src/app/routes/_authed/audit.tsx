import { createFileRoute } from "@tanstack/react-router";
import { AuditPage, auditSearchSchema } from "@/contexts/access";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/audit")({ validateSearch: auditSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["audit.read"]}>
      <AuditPage search={search} onSearchChange={(s) => void navigate({ search: s })} />
    </RequirePermission>
  );
}
