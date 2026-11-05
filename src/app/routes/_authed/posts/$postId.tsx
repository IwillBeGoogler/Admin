import { createFileRoute, notFound } from "@tanstack/react-router";
import { PostEditorPage } from "@/contexts/content";

export const Route = createFileRoute("/_authed/posts/$postId")({
  params: {
    parse: (p) => {
      const id = Number(p.postId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { postId: id };
    },
    stringify: (p) => ({ postId: String(p.postId) }),
  },
  component: Page,
});

/** Authors and post.update holders may edit; the API enforces ownership. */
function Page() {
  const { postId } = Route.useParams();
  return <PostEditorPage postId={postId} onSaved={() => {}} />;
}
