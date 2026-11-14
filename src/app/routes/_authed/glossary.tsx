import { createFileRoute } from "@tanstack/react-router";
import { GlossaryPage } from "@/contexts/content";
import { RequirePermission } from "@/contexts/identity";

export const Route = createFileRoute("/_authed/glossary")({
  component: () => (
    <RequirePermission anyOf={["glossary.write"]}>
      <GlossaryPage />
    </RequirePermission>
  ),
});
