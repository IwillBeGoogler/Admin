import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { runBulk } from "@/shared/lib/bulk";
import { notifySuccess } from "@/shared/lib/notify";
import { key } from "@/shared/lib/shortcuts";
import { useHotkeys } from "@/shared/lib/useHotkeys";
import { Button } from "./button";

export type Selection = ReadonlySet<string>;

/** Selected row ids; cleared whenever `resetKey` (the active filters) changes. */
export function useRowSelection(resetKey: unknown) {
  const scope = JSON.stringify(resetKey ?? null);
  const [state, setState] = useState<{ scope: string; ids: Selection }>({ scope, ids: new Set() });
  const ids = state.scope === scope ? state.ids : new Set<string>();
  const setIds = (next: Selection) => setState({ scope, ids: next });
  return [ids, setIds] as const;
}

/**
 * Runs one single-item mutation per selected row (at most 4 in flight) and
 * reports once: "12 deleted" or "10 deleted, 2 failed" with "Show failed",
 * which re-selects only the rows that failed.
 */
export function useBulkRunner<T>(getId: (row: T) => string, setSelected: (s: Selection) => void) {
  const { t } = useI18n();
  return async (rows: readonly T[], fn: (row: T) => Promise<unknown>, done: MessageKey) => {
    const { ok, failed } = await runBulk(rows, fn, 4);
    setSelected(new Set());
    if (failed.length === 0) {
      notifySuccess(t(done, { n: ok.length }));
      return;
    }
    const failedIds = new Set(failed.map(getId));
    toast.error(`${t(done, { n: ok.length })}, ${t("bulk.failed", { n: failed.length })}`, {
      duration: Number.POSITIVE_INFINITY,
      action: { label: t("bulk.showFailed"), onClick: () => setSelected(failedIds) },
    });
  };
}

/** Floating action bar for the current selection; Esc clears it. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  const { t } = useI18n();
  useHotkeys({ [key("clearSelection")]: onClear }, count > 0);
  if (count === 0) return null;
  return (
    <section
      aria-label={t("bulk.label")}
      className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
    >
      <span className="text-sm font-medium tabular-nums" aria-live="polite">
        {t("bulk.selected", { n: count })}
      </span>
      {children}
      <Button variant="ghost" size="sm" onClick={onClear}>
        {t("bulk.clear")}
      </Button>
    </section>
  );
}
