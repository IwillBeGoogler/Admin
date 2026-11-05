import { createFileRoute } from "@tanstack/react-router";
import { BansPage, bansSearchSchema } from "@/contexts/community";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/bans")({ validateSearch: bansSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["user.ban"]}>
      <BansPage search={search} onSearchChange={(s) => void navigate({ search: s })} />
    </RequirePermission>
  );
}
