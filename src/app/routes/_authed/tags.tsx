import { createFileRoute } from "@tanstack/react-router";
import { TagsPage } from "@/contexts/content";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/tags")({
  component: () => (
    <RequirePermission anyOf={[]}>
      <TagsPage />
    </RequirePermission>
  ),
});
