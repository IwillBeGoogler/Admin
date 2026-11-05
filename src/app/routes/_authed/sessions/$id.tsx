import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SessionDetailPage } from "@/contexts/access";

/** ?user=N opens another user's session (needs session.read). */
const searchSchema = z.object({ user: z.coerce.number().int().positive().optional().catch(undefined) });

export const Route = createFileRoute("/_authed/sessions/$id")({ validateSearch: searchSchema, component: Page });

function Page() {
  const { id } = Route.useParams();
  const { user } = Route.useSearch();
  return <SessionDetailPage id={id} userId={user} />;
}
