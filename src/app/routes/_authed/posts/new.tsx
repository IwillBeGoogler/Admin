import { createFileRoute } from "@tanstack/react-router";
import { PostEditorPage } from "@/contexts/content";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/posts/new")({ component: Page });

function Page() {
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["post.create"]}>
      <PostEditorPage onSaved={(id) => void navigate({ to: "/posts/$postId", params: { postId: id } })} />
    </RequirePermission>
  );
}
