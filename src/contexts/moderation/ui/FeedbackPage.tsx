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
import { useDecideFeedback, useFeedback } from "../application/hooks";
import {
  type Feedback,
  type FeedbackKind,
  type FeedbackSearch,
  type FeedbackStatus,
  feedbackKinds,
} from "../domain/feedback";

const col = createColumnHelper<Features, Feedback>();
const statusVariant = { open: "warning", resolved: "success", dismissed: "secondary" } as const;
const statusTabs = ["open", "resolved", "dismissed", "all"] as const;
const kindTabs = ["all", ...feedbackKinds] as const;

const kindKey = (k: string) =>
  (feedbackKinds as readonly string[]).includes(k) ? (`feedback.k.${k as FeedbackKind}` as const) : undefined;

export function FeedbackPage({
  search,
  onSearchChange,
}: {
  search: FeedbackSearch;
  onSearchChange: (s: FeedbackSearch) => void;
}) {
  const { t } = useI18n();
  const feedback = useFeedback(search);
  const [viewing, setViewing] = useState<Feedback | null>(null);
  const change = (patch: Partial<FeedbackSearch>) => onSearchChange({ ...search, ...patch });

  const columns: Columns<Feedback> = [
    col.accessor("id", {
      header: "#",
      meta: { sortable: true },
      cell: (c) => <span className="tabular-nums text-muted-foreground">{c.getValue()}</span>,
    }),
    col.accessor("kind", {
      header: () => t("feedback.kind"),
      meta: { sortable: true },
      cell: (c) => {
        const key = kindKey(c.getValue());
        return <Badge variant="outline">{key ? t(key) : c.getValue()}</Badge>;
      },
    }),
    col.accessor("message", {
      header: () => t("feedback.message"),
      cell: (c) => (
        <span className="line-clamp-2 max-w-md text-sm" title={c.getValue()}>
          {c.getValue()}
        </span>
      ),
    }),
    col.accessor("username", {
      header: () => t("feedback.sender"),
      meta: { sortable: true },
      cell: (c) => (c.getValue() ? `@${c.getValue()}` : t("feedback.anonymous")),
    }),
    col.accessor("status", {
      header: () => t("reports.status"),
      cell: (c) => (
        <Badge variant={statusVariant[c.row.original.status]}>{t(`feedback.s.${c.row.original.status}`)}</Badge>
      ),
    }),
    col.accessor("created_at", {
      header: () => t("audit.when"),
      meta: { sortable: true },
      cell: (c) => <RelativeTime value={c.getValue()} />,
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: (c) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            aria-label={`${t("feedback.view")} #${c.row.original.id}`}
            onClick={() => setViewing(c.row.original)}
          >
            <EyeIcon aria-hidden />
            {t("feedback.view")}
          </Button>
        </div>
      ),
    }),
  ];

  const items = feedback.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeader title={t("feedback.title")} />
      <ListView
        query={feedback}
        items={items}
        empty={{ title: t("feedback.empty") }}
        filtered={search.status !== "open" || search.kind !== "all"}
        onClearFilters={() => onSearchChange({ status: "open", kind: "all" })}
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
                  onClick={() => change({ status: s })}
                >
                  {s === "all" ? t("common.all") : t(`feedback.s.${s}`)}
                </Button>
              ))}
            </fieldset>
            <fieldset className="flex flex-wrap gap-1">
              <legend className="sr-only">{t("feedback.kind")}</legend>
              {kindTabs.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={search.kind === k ? "secondary" : "ghost"}
                  aria-pressed={search.kind === k}
                  onClick={() => change({ kind: k })}
                >
                  {k === "all" ? t("common.all") : t(`feedback.k.${k}`)}
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
            caption={t("feedback.title")}
            getRowId={(r) => String(r.id)}
            sort={parseSort(search.sort)}
            onSortChange={(s) => change({ sort: serializeSort(s) })}
            rowLabel={(r) => `#${r.id}`}
          />
        )}
      </ListView>
      {viewing ? <FeedbackDialog key={viewing.id} feedback={viewing} onClose={() => setViewing(null)} /> : null}
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

/** Full message and diagnostics, with resolve / dismiss (or reopen once decided). */
function FeedbackDialog({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const { t } = useI18n();
  const decide = useDecideFeedback();
  const pending = decide.isPending;
  const set = (status: FeedbackStatus) =>
    decide.mutate(
      { feedback, status },
      {
        onSuccess: () => {
          notifySuccess(t("feedback.decided", { status: t(`feedback.s.${status}`) }));
          onClose();
        },
        onError: (e) => notifyError(e, { label: t("common.retry"), onClick: () => set(status) }),
      },
    );
  const key = kindKey(feedback.kind);
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent closeLabel={t("common.close")} locked={pending} className="max-w-2xl">
        <DialogTitle>{t("feedback.detailTitle", { id: feedback.id })}</DialogTitle>
        <DialogDescription>
          {key ? t(key) : feedback.kind} · {feedback.username ? `@${feedback.username}` : t("feedback.anonymous")}
        </DialogDescription>
        <dl className="grid gap-3">
          <div className="grid gap-1">
            <dt className="text-xs font-medium text-muted-foreground">{t("feedback.message")}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm">{feedback.message}</dd>
          </div>
          <Detail label={t("feedback.contact")}>{feedback.contact_email}</Detail>
          <Detail label={t("feedback.page")}>{feedback.page_url}</Detail>
          <Detail label={t("feedback.agent")}>{feedback.user_agent}</Detail>
          <Detail label={t("feedback.version")}>{feedback.app_version}</Detail>
          <Detail label={t("feedback.errorMessage")}>{feedback.error_message}</Detail>
          {feedback.error_stack ? (
            <div className="grid gap-1">
              <dt className="text-xs font-medium text-muted-foreground">{t("feedback.errorStack")}</dt>
              <dd>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{feedback.error_stack}</pre>
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
          {feedback.status === "open" ? (
            <>
              <Button variant="outline" onClick={() => set("dismissed")} disabled={pending}>
                <XIcon aria-hidden />
                {t("reports.dismiss")}
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
                {t("feedback.reopen")}
              </PendingLabel>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
