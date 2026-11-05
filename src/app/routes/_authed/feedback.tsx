import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/contexts/identity";
import { FeedbackPage, feedbackSearchSchema } from "@/contexts/moderation";

export const Route = createFileRoute("/_authed/feedback")({ validateSearch: feedbackSearchSchema, component: Page });

function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequirePermission anyOf={["report.moderate"]}>
      <FeedbackPage search={search} onSearchChange={(s) => void navigate({ search: s })} />
    </RequirePermission>
  );
}
