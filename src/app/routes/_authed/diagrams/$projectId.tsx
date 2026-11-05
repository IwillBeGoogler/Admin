import { createFileRoute } from "@tanstack/react-router";
import { DiagramProjectPage } from "@/contexts/diagrams";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/diagrams/$projectId")({ component: Page });

function Page() {
  const { projectId } = Route.useParams();
  return (
    <RequirePermission anyOf={["diagrams.read", "diagrams.manage"]}>
      <DiagramProjectPage id={projectId} />
    </RequirePermission>
  );
}
