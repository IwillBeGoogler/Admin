import { createFileRoute } from "@tanstack/react-router";
import { UsersPage, usersSearchSchema } from "@/contexts/community";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/users")({ validateSearch: usersSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["user.read"]}>
      <UsersPage search={search} onSearchChange={(s, o) => void navigate({ search: s, replace: o?.replace })} />
    </RequirePermission>
  );
}
