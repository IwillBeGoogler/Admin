import { createFileRoute } from "@tanstack/react-router";
import { RoleDetailPage } from "@/contexts/access";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/roles/$name")({ component: Page });

function Page() {
  const { name } = Route.useParams();
  return (
    <RequirePermission anyOf={["role.read"]}>
      <RoleDetailPage name={name} />
    </RequirePermission>
  );
}
