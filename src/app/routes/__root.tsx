import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { useI18n } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/states";
import type { RouterContext } from "../router";

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-[50dvh] place-items-center gap-4 text-center">
      <div className="grid gap-3">
        <p className="text-4xl font-semibold">404</p>
        <p className="text-muted-foreground">{t("common.notFound")}</p>
        <Button asChild variant="outline">
          <Link to="/">{t("common.goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <ErrorState error={error} onRetry={reset} />
    </div>
  ),
});
