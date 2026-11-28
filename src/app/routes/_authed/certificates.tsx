import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/contexts/identity";
import { CertificatesPage } from "@/contexts/moderation";

export const Route = createFileRoute("/_authed/certificates")({
  component: () => (
    <RequirePermission anyOf={["certificate.revoke"]}>
      <CertificatesPage />
    </RequirePermission>
  ),
});
