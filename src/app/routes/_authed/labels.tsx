import { createFileRoute } from "@tanstack/react-router";
import { LabelsPage } from "@/contexts/content";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/labels")({
  component: () => (
    <RequirePermission anyOf={["label.write"]}>
      <LabelsPage />
    </RequirePermission>
  ),
});
