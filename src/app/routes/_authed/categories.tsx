import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/contexts/content";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/categories")({
  component: () => (
    <RequirePermission anyOf={["category.write"]}>
      <CategoriesPage />
    </RequirePermission>
  ),
});
