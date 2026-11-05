import { useI18n } from "@/shared/i18n";
import { Button } from "./button";

/** Cursor/page pager for infinite queries; announces totals politely. */
export function LoadMore({
  shown,
  total,
  hasNext,
  loading,
  onMore,
}: {
  shown: number;
  total: number;
  hasNext: boolean;
  loading: boolean;
  onMore: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-3 text-sm text-muted-foreground">
      <span aria-live="polite">
        {shown} / {t("common.total", { n: Math.max(total, shown) })}
      </span>
      {hasNext ? (
        <Button variant="outline" size="sm" onClick={onMore} disabled={loading}>
          {loading ? t("common.loading") : t("common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
