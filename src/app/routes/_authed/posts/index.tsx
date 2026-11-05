import { createFileRoute } from "@tanstack/react-router";
import { PostsPage, postFiltersSchema } from "@/contexts/content";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/posts/")({ validateSearch: postFiltersSchema, component: Page });

function Page() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["post.update", "post.delete", "post.create"]}>
      <PostsPage filters={filters} onFiltersChange={(f, o) => void navigate({ search: f, replace: o?.replace })} />
    </RequirePermission>
  );
}
