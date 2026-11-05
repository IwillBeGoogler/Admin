import { createColumnHelper } from "@tanstack/react-table";
import { CheckIcon, EyeIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { notifyError, notifySuccess } from "@/shared/lib/notify";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, PendingLabel } from "@/shared/ui/dialog";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { PageHeader } from "@/shared/ui/states";
import { useClientErrors, useDecideClientError } from "../application/hooks";
import type { ClientError, ClientErrorStatus, ClientErrorsSearch } from "../domain/clientError";

const col = createColumnHelper<Features, ClientError>();
const statusVariant = { open: "warning", resolved: "success", ignored: "secondary" } as const;
const statusTabs = ["open", "resolved", "ignored", "all"] as const;

export function ClientErrorsPage({
  search,
  onSearchChange,
}: {
  search: ClientErrorsSearch;
  onSearchChange: (s: ClientErrorsSearch) => void;
}) {
  const { t } = useI18n();
  const errors = useClientErrors(search);
  const [viewing, setViewing] = useState<ClientError | null>(null);

  const columns: Columns<ClientError> = [
    col.accessor("message", {
      header: () => t("clientErrors.message"),
      cell: (c) => (
        <span className="line-clamp-2 max-w-md text-sm" title={c.getValue()}>
          {c.getValue()}
        </span>
      ),
    }),
    col.accessor("count", {
      header: () => t("clientErrors.count"),
      meta: { sortable: true },
      cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
    }),
    col.accessor("first_seen", {
      header: () => t("clientErrors.firstSeen"),
      meta: { sortable: true },
      cell: (c) => <RelativeTime value={c.getValue()} />,
    }),
    col.accessor("last_seen", {
      header: () => t("clientErrors.lastSeen"),
      meta: { sortable: true },
      cell: (c) => <RelativeTime value={c.getValue()} />,
    }),
    col.accessor("status", {
      header: () => t("reports.status"),
      cell: (c) => (
        <Badge variant={statusVariant[c.row.original.status]}>{t(`clientErrors.s.${c.row.original.status}`)}</Badge>
      ),
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: (c) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            aria-label={`${t("clientErrors.view")} #${c.row.original.id}`}
            onClick={() => setViewing(c.row.original)}
          >
            <EyeIcon aria-hidden />
            {t("clientErrors.view")}
          </Button>
        </div>
      ),
    }),
  ];

  const items = errors.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeader title={t("clientErrors.title")} />
      <ListView
        query={errors}
        items={items}
        empty={{ title: t("clientErrors.empty") }}
        filtered={search.status !== "open"}
        onClearFilters={() => onSearchChange({ status: "open" })}
        toolbar={
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border p-3">
            <fieldset className="flex flex-wrap gap-1">
              <legend className="sr-only">{t("reports.status")}</legend>
              {statusTabs.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={search.status === s ? "secondary" : "ghost"}
                  aria-pressed={search.status === s}
                  onClick={() => onSearchChange({ ...search, status: s })}
                >
                  {s === "all" ? t("common.all") : t(`clientErrors.s.${s}`)}
                </Button>
              ))}
            </fieldset>
          </div>
        }
      >
        {(rows) => (
          <DataTable
            columns={columns}
            data={rows}
            caption={t("clientErrors.title")}
            getRowId={(r) => String(r.id)}
            sort={parseSort(search.sort)}
            onSortChange={(s) => onSearchChange({ ...search, sort: serializeSort(s) })}
            rowLabel={(r) => `#${r.id}`}
          />
        )}
      </ListView>
      {viewing ? <ClientErrorDialog key={viewing.id} error={viewing} onClose={() => setViewing(null)} /> : null}
    </>
  );
}

function Detail({ label, children }: { label: string; children: string }) {
  if (!children) return null;
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

/** Message, stack, page and browser, with resolve / ignore (or reopen once decided). */
function ClientErrorDialog({ error, onClose }: { error: ClientError; onClose: () => void }) {
  const { t } = useI18n();
  const decide = useDecideClientError();
  const pending = decide.isPending;
  const set = (status: ClientErrorStatus) =>
    decide.mutate(
      { error, status },
      {
        onSuccess: () => {
          notifySuccess(t("clientErrors.decided", { status: t(`clientErrors.s.${status}`) }));
          onClose();
        },
        onError: (e) => notifyError(e, { label: t("common.retry"), onClick: () => set(status) }),
      },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent closeLabel={t("common.close")} locked={pending} className="max-w-2xl">
        <DialogTitle>{t("clientErrors.detailTitle", { id: error.id })}</DialogTitle>
        <DialogDescription>
          {t("clientErrors.count")}: {error.count}
        </DialogDescription>
        <dl className="grid gap-3">
          <Detail label={t("clientErrors.message")}>{error.message}</Detail>
          <Detail label={t("clientErrors.page")}>{error.page_url}</Detail>
          <Detail label={t("clientErrors.agent")}>{error.user_agent}</Detail>
          {error.stack ? (
            <div className="grid gap-1">
              <dt className="text-xs font-medium text-muted-foreground">{t("clientErrors.stack")}</dt>
              <dd>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{error.stack}</pre>
              </dd>
            </div>
          ) : null}
        </dl>
        {decide.error ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(decide.error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("common.close")}
          </Button>
          {error.status === "open" ? (
            <>
              <Button variant="outline" onClick={() => set("ignored")} disabled={pending}>
                <XIcon aria-hidden />
                {t("clientErrors.ignore")}
              </Button>
              <Button onClick={() => set("resolved")} disabled={pending} aria-busy={pending || undefined}>
                <PendingLabel pending={pending}>
                  <CheckIcon aria-hidden />
                  {t("reports.resolve")}
                </PendingLabel>
              </Button>
            </>
          ) : (
            <Button onClick={() => set("open")} disabled={pending} aria-busy={pending || undefined}>
              <PendingLabel pending={pending}>
                <RotateCcwIcon aria-hidden />
                {t("clientErrors.reopen")}
              </PendingLabel>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
