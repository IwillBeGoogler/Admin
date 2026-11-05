import { SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Button } from "./button";
import { Card } from "./card";
import { LoadMore } from "./load-more";
import { EmptyState, ErrorState, LoadingRows } from "./states";

/** The parts of a plain or infinite TanStack Query result the list needs. */
export interface ListQuery {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
  data?: unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => unknown;
}

const pageTotal = (data: unknown): number => {
  const pages = (data as { pages?: { meta?: { total?: number } }[] } | undefined)?.pages;
  return pages?.[0]?.meta?.total ?? 0;
};

/**
 * Shared list scaffold: toolbar, then exactly one of loading skeleton, error,
 * empty ("Clear filters" when filtered), or the rows with Load more.
 * A background refetch shows a thin bar and keeps the stale rows on screen.
 */
export function ListView<T>({
  query,
  items,
  toolbar,
  empty,
  filtered = false,
  onClearFilters,
  bare = false,
  className,
  children,
}: {
  query: ListQuery;
  items: T[];
  toolbar?: ReactNode;
  empty: { title: ReactNode; hint?: ReactNode; action?: ReactNode };
  filtered?: boolean;
  onClearFilters?: () => void;
  /** Render without the Card wrapper (for lists of cards). */
  bare?: boolean;
  className?: string;
  children: (items: T[]) => ReactNode;
}) {
  const { t } = useI18n();
  const refetching = query.isFetching && !query.isPending && !query.isFetchingNextPage;
  const body = query.isPending ? (
    <div className={bare ? "" : "p-4"}>
      <LoadingRows rows={8} />
    </div>
  ) : query.isError && items.length === 0 ? (
    <div className={bare ? "" : "p-4"}>
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    </div>
  ) : items.length === 0 ? (
    filtered ? (
      <EmptyState
        icon={SearchXIcon}
        title={t("list.noResults")}
        hint={t("list.noResultsHint")}
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              {t("list.clearFilters")}
            </Button>
          ) : undefined
        }
      />
    ) : (
      <EmptyState title={empty.title} hint={empty.hint} action={empty.action} />
    )
  ) : (
    <>
      {children(items)}
      {query.fetchNextPage ? (
        <LoadMore
          shown={items.length}
          total={pageTotal(query.data)}
          hasNext={!!query.hasNextPage}
          loading={!!query.isFetchingNextPage}
          onMore={() => void query.fetchNextPage?.()}
        />
      ) : null}
    </>
  );
  const bar = refetching ? (
    <div
      role="progressbar"
      aria-label={t("list.refreshing")}
      className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse rounded-t-xl bg-primary/60"
    />
  ) : null;
  if (bare)
    return (
      <div className={cn("relative grid gap-4", className)} aria-busy={refetching || undefined}>
        {bar}
        {toolbar}
        {body}
      </div>
    );
  return (
    <Card className={cn("relative", className)} aria-busy={refetching || undefined}>
      {bar}
      {toolbar}
      {body}
    </Card>
  );
}
