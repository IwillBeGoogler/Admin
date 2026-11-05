import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/contexts/identity";
import { CommentsPage, commentsSearchSchema } from "@/contexts/moderation";

export const Route = createFileRoute("/_authed/comments")({ validateSearch: commentsSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["comment.moderate"]}>
      <CommentsPage search={search} onSearchChange={(s, o) => void navigate({ search: s, replace: o?.replace })} />
    </RequirePermission>
  );
}
