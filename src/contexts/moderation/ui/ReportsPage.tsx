import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { CheckIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { errorMessage, isApiError } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { formatBadgeCount } from "@/shared/lib/format";
import { notifyError, notifySuccess, notifyWarning } from "@/shared/lib/notify";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { BulkBar, useBulkRunner, useRowSelection } from "@/shared/ui/bulk-bar";
import { Button } from "@/shared/ui/button";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  PendingLabel,
} from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { PageHeader } from "@/shared/ui/states";
import { useDecideReport, useOpenReportCount, useReports } from "../application/hooks";
import { canDecide, canRemoveContent, type Decision, type Report, type ReportsSearch } from "../domain/report";

const col = createColumnHelper<Features, Report>();
const statusVariant = { open: "warning", resolved: "success", dismissed: "secondary" } as const;
const tabs = ["open", "resolved", "dismissed", "all"] as const;

function Target({ r }: { r: Report }) {
  const { t } = useI18n();
  if (r.target_type === "diagram") {
    const label = `${t("reports.t.diagram")} ${r.target_file_id ?? ""}`.trim();
    return r.target_project_id ? (
      <Link
        to="/diagrams/$projectId"
        params={{ projectId: r.target_project_id }}
        className="font-medium hover:underline"
      >
        {label}
      </Link>
    ) : (
      <span className="font-medium">{label}</span>
    );
  }
  const label = `${t(`reports.t.${r.target_type}`)} #${r.target_id}`;
  if (r.target_type === "post")
    return (
      <Link to="/posts/$postId" params={{ postId: r.target_id }} className="font-medium hover:underline">
        {label}
      </Link>
    );
  return <span className="font-medium">{label}</span>;
}

export function ReportsPage({
  search,
  onSearchChange,
}: {
  search: ReportsSearch;
  onSearchChange: (s: ReportsSearch) => void;
}) {
  const { t } = useI18n();
  const reports = useReports({ status: search.status });
  const openCount = useOpenReportCount();
  const decide = useDecideReport();
  const [deciding, setDeciding] = useState<{ report: Report; status: Decision } | null>(null);
  const [selected, setSelected] = useRowSelection(search.status);
  const [bulk, setBulk] = useState<Decision | null>(null);
  const runBulk = useBulkRunner<Report>((r) => String(r.id), setSelected);

  const columns: Columns<Report> = [
    col.accessor("id", {
      header: "#",
      meta: { sortable: true },
      cell: (c) => <span className="tabular-nums text-muted-foreground">{c.getValue()}</span>,
    }),
    col.display({ id: "target", header: () => t("reports.target"), cell: (c) => <Target r={c.row.original} /> }),
    col.accessor("reason", {
      header: () => t("reports.reason"),
      meta: { sortable: true },
      cell: (c) => (
        <div className="grid max-w-xs gap-1">
          <Badge variant="outline" className="w-fit">
            {(reportReasonKey(c.getValue()) && t(reportReasonKey(c.getValue()) as MessageKey)) || c.getValue()}
          </Badge>
          {c.row.original.note ? (
            <span className="truncate text-xs text-muted-foreground" title={c.row.original.note}>
              {c.row.original.note}
            </span>
          ) : null}
        </div>
      ),
    }),
    col.accessor("reporter", {
      header: () => t("reports.reporter"),
      meta: { sortable: true },
      cell: (c) => (c.getValue() ? `@${c.getValue()}` : "—"),
    }),
    col.accessor("reports", {
      header: () => t("reports.openOnTarget"),
      meta: { sortable: true, className: "tabular-nums" },
      cell: (c) => c.getValue(),
    }),
    col.accessor("status", {
      header: () => t("reports.status"),
      cell: (c) => (
        <Badge variant={statusVariant[c.row.original.status]}>{t(`reports.s.${c.row.original.status}`)}</Badge>
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
      cell: (c) =>
        canDecide(c.row.original) ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              aria-label={`${t("reports.resolve")} #${c.row.original.id}`}
              onClick={() => setDeciding({ report: c.row.original, status: "resolved" })}
            >
              <CheckIcon aria-hidden />
              {t("reports.resolve")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${t("reports.dismiss")} #${c.row.original.id}`}
              onClick={() => setDeciding({ report: c.row.original, status: "dismissed" })}
            >
              <XIcon aria-hidden />
              {t("reports.dismiss")}
            </Button>
          </div>
        ) : null,
    }),
  ];

  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];
  const selectedRows = items.filter((r) => selected.has(String(r.id)) && canDecide(r));
  const openPill = formatBadgeCount(openCount.data);
  const bulkAction = bulk ? t(bulk === "resolved" ? "reports.resolve" : "reports.dismiss") : "";
  return (
    <>
      <PageHeader title={t("reports.title")} />
      <ListView
        query={reports}
        items={items}
        empty={{ title: t("reports.empty") }}
        toolbar={
          <fieldset className="flex flex-wrap gap-1 border-b border-border p-3">
            <legend className="sr-only">{t("reports.status")}</legend>
            {tabs.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={search.status === s ? "secondary" : "ghost"}
                aria-pressed={search.status === s}
                onClick={() => onSearchChange(search.sort ? { status: s, sort: search.sort } : { status: s })}
              >
                {s === "all" ? t("common.all") : t(`reports.s.${s}`)}
                {s === "open" && openPill ? (
                  <>
                    <span
                      aria-hidden
                      className="rounded-full bg-destructive/10 px-1.5 text-xs tabular-nums text-destructive"
                    >
                      {openPill}
                    </span>
                    <span className="sr-only">, {t("confirm.reportsOpen", { n: openPill })}</span>
                  </>
                ) : null}
              </Button>
            ))}
          </fieldset>
        }
      >
        {(rows) => (
          <DataTable
            columns={columns}
            data={rows}
            caption={t("reports.title")}
            getRowId={(r) => String(r.id)}
            sort={parseSort(search.sort)}
            onSortChange={(s) => onSearchChange({ ...search, sort: serializeSort(s) })}
            selectable
            canSelect={canDecide}
            selected={selected}
            onSelectedChange={setSelected}
            rowLabel={(r) => `#${r.id}`}
            hotkeys
          />
        )}
      </ListView>
      <BulkBar count={selectedRows.length} onClear={() => setSelected(new Set())}>
        <Button variant="outline" size="sm" onClick={() => setBulk("resolved")}>
          <CheckIcon aria-hidden />
          {t("reports.resolve")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBulk("dismissed")}>
          <XIcon aria-hidden />
          {t("reports.dismiss")}
        </Button>
      </BulkBar>
      <ConfirmDialog
        open={bulk !== null}
        onOpenChange={(o) => !o && setBulk(null)}
        variant="default"
        title={t("confirm.bulkDecide", { action: bulkAction, n: selectedRows.length })}
        description={t("confirm.bulkDecideBody")}
        confirmLabel={bulkAction}
        cancelLabel={t("common.cancel")}
        onConfirm={() =>
          bulk &&
          runBulk(
            selectedRows,
            (report) => decide.mutateAsync({ report, status: bulk, removeContent: false }),
            bulk === "resolved" ? "bulk.resolved" : "bulk.dismissed",
          )
        }
      />
      {deciding ? (
        <DecideDialog
          key={`${deciding.report.id}-${deciding.status}`}
          {...deciding}
          onClose={() => setDeciding(null)}
        />
      ) : null}
    </>
  );
}

const reportReasonKey = (r: string) =>
  ["spam", "abuse", "harassment", "off_topic", "other"].includes(r) ? `reports.r.${r}` : undefined;

/** Resolving with "remove content" is destructive: red confirm, spinner, Esc locked while in flight. */
function DecideDialog({ report, status, onClose }: { report: Report; status: Decision; onClose: () => void }) {
  const { t } = useI18n();
  const decide = useDecideReport();
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const action = t(status === "resolved" ? "reports.resolve" : "reports.dismiss");
  const pending = decide.isPending;
  const inFlight = useRef(false);
  const submit = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    decide.mutate(
      { report, status, removeContent: remove },
      {
        onSettled: () => {
          inFlight.current = false;
        },
        onSuccess: () => {
          notifySuccess(t("reports.decided", { status: t(`reports.s.${status}`) }));
          onClose();
        },
        onError: (e) => {
          if (isApiError(e) && e.isConflict) {
            notifyWarning(t("reports.conflict"));
            onClose();
          } else {
            setError(e);
            notifyError(e, { label: t("common.retry"), onClick: submit });
          }
        },
      },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent closeLabel={t("common.close")} locked={pending}>
        <DialogTitle>{t("reports.decideTitle", { action, id: report.id })}</DialogTitle>
        <DialogDescription>
          <Target r={report} /> · {report.note || "—"}
        </DialogDescription>
        {canRemoveContent(report, status) ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={remove} disabled={pending} onChange={(e) => setRemove(e.target.checked)} />
            {t("reports.removeContent")}
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={remove ? "destructive" : "default"}
            onClick={submit}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            <PendingLabel pending={pending}>{action}</PendingLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
