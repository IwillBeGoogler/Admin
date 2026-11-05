import { AlertTriangleIcon, InboxIcon, type LucideIcon, WifiOffIcon } from "lucide-react";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { errorMessage, isApiError } from "@/shared/http/problem";
import { useI18n } from "@/shared/i18n";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const forbidden = isApiError(error) && error.isForbidden;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm"
    >
      <AlertTriangleIcon className="size-6 text-destructive" aria-hidden />
      <p className="font-medium">{forbidden ? t("common.forbidden") : t("common.error")}</p>
      {!forbidden ? <p className="text-muted-foreground">{errorMessage(error)}</p> : null}
      {onRetry && !forbidden ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

/** Table placeholder with fixed row height so content does not shift in. */
export function LoadingRows({ rows = 5, label }: { rows?: number; label?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className="grid gap-2 py-2">
      <span className="sr-only">{label ?? t("common.loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function OfflineBanner() {
  const { t } = useI18n();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-warning/15 px-4 py-2 text-sm text-foreground">
      <WifiOffIcon className="size-4 text-warning" aria-hidden />
      {t("common.offline")}
    </div>
  );
}

/** Sets `document.title` to "{page} · {app name}" while mounted. */
export function usePageTitle(title: string | undefined) {
  const { t } = useI18n();
  const app = t("app.name");
  useEffect(() => {
    document.title = title ? `${title} · ${app}` : app;
  }, [title, app]);
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  usePageTitle(title);
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {/* tabIndex -1: the layout moves focus here after each navigation */}
        <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
