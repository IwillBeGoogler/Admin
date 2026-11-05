import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { currentAdminQuery, isAdmin, isSignedIn, useAuthToken, useCurrentAdmin, useLogout } from "@/contexts/identity";
import { onSessionExpired } from "@/shared/api";
import { isApiError } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { LoadingRows } from "@/shared/ui/states";
import { AdminLayout } from "../layout/AdminLayout";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    if (!isSignedIn()) throw redirect({ to: "/login", search: { redirect: location.href } });
    try {
      await context.queryClient.ensureQueryData(currentAdminQuery());
    } catch (e) {
      if (isApiError(e) && e.status === 401)
        throw redirect({ to: "/login", search: { redirect: location.href, expired: true } });
      throw e;
    }
  },
  component: Authed,
  pendingComponent: () => (
    <div className="p-6">
      <LoadingRows rows={3} />
    </div>
  ),
});

function NoAccess() {
  const { t } = useI18n();
  const logout = useLogout();
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-4">
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>{t("common.forbidden")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t("auth.noAccess")}</p>
          <Button onClick={() => logout.mutate()}>{t("auth.logout")}</Button>
        </CardContent>
      </Card>
    </main>
  );
}

function Authed() {
  const token = useAuthToken();
  const router = useRouter();
  const { data: admin } = useCurrentAdmin();
  const leaving = useRef(false);

  // Leave once when the session ends (logout, failed refresh); never loop on href changes.
  useEffect(() => {
    const toLogin = (expired: boolean) => {
      if (leaving.current) return;
      leaving.current = true;
      const redirect = router.state.location.href;
      void router.navigate({ to: "/login", search: expired ? { redirect, expired: true } : { redirect } });
    };
    const off = onSessionExpired(() => toLogin(true));
    if (!token) toLogin(false);
    return off;
  }, [token, router]);

  if (!admin) return null;
  if (!isAdmin(admin.permissions)) return <NoAccess />;
  return (
    <AdminLayout admin={admin}>
      <Outlet />
    </AdminLayout>
  );
}
