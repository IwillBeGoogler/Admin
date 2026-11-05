import { createFileRoute } from "@tanstack/react-router";
import { TemplatesPage } from "@/contexts/diagrams";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/diagram-templates")({
  component: () => (
    <RequirePermission anyOf={["templates.manage"]}>
      <TemplatesPage />
    </RequirePermission>
  ),
});
