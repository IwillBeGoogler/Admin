import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { BoxesIcon, PencilRulerIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/lib/format";
import { notifySuccess } from "@/shared/lib/notify";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { useSearchText } from "@/shared/lib/useSearchText";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { FilterChips } from "@/shared/ui/filter-chips";
import { Label } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { SearchInput } from "@/shared/ui/search-input";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState, PageHeader } from "@/shared/ui/states";
import { useDeleteProject, useDiagramProjects, useDiagramStats } from "../application/hooks";
import { fileKinds, formatBytes, type ProjectSummary, type ProjectsSearch } from "../domain/diagram";

const col = createColumnHelper<Features, ProjectSummary>();

function StatCard({ label, value, hint }: { label: string; value: string | undefined; hint?: string }) {
  return (
    <Card>
      <CardContent className="grid gap-1 pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        )}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : <p className="h-4" aria-hidden />}
      </CardContent>
    </Card>
  );
}

function Stats() {
  const { t, locale } = useI18n();
  const stats = useDiagramStats();
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  const s = stats.data;
  const n = (v: number | undefined) => (v === undefined ? undefined : formatNumber(v, locale));
  const kinds = s ? fileKinds.map((k) => `${t(`diagrams.kind.${k}`)} ${formatNumber(s.files_by_kind[k], locale)}`) : [];
  return (
    <section aria-label={t("diagrams.stats")} className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t("diagrams.projects")} value={n(s?.projects)} />
      <StatCard label={t("diagrams.files")} value={n(s?.files)} hint={kinds.join(" · ")} />
      <StatCard label={t("diagrams.editors7d")} value={n(s?.active_editors_7d)} />
      <StatCard label={t("diagrams.storage")} value={s ? formatBytes(s.storage_bytes, locale) : undefined} />
    </section>
  );
}

export function DiagramsPage({
  search,
  onSearchChange,
}: {
  search: ProjectsSearch;
  onSearchChange: (s: ProjectsSearch, opts?: { replace?: boolean }) => void;
}) {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const manage = can("diagrams.manage");
  const [q, setQ] = useSearchText(search.q, (v) => onSearchChange({ ...search, q: v }, { replace: true }));
  const projects = useDiagramProjects({ q: search.q, owner: search.owner });
  const del = useDeleteProject();
  const [target, setTarget] = useState<ProjectSummary | null>(null);

  const columns: Columns<ProjectSummary> = [
    col.accessor("name", {
      header: () => t("common.name"),
      meta: { sortable: true },
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          {c.row.original.thumbnail_url ? (
            <img
              src={c.row.original.thumbnail_url}
              alt=""
              className="size-8 rounded border border-border object-cover"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded border border-border text-muted-foreground">
              <PencilRulerIcon className="size-4" aria-hidden />
            </span>
          )}
          <Link
            to="/diagrams/$projectId"
            params={{ projectId: c.row.original.id }}
            className="max-w-64 truncate font-medium hover:underline"
          >
            {c.getValue()}
          </Link>
          {c.row.original.shared ? <Badge variant="outline">{t("diagrams.shared")}</Badge> : null}
        </div>
      ),
    }),
    col.accessor((r) => r.owner.username, {
      id: "owner",
      header: () => t("diagrams.owner"),
      meta: { sortable: true },
      cell: (c) => (
        <button
          type="button"
          className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("diagrams.filterOwner", { name: c.getValue() })}
          onClick={() => onSearchChange({ ...search, owner: c.getValue() })}
        >
          @{c.getValue()}
        </button>
      ),
    }),
    col.accessor("files", {
      header: () => t("diagrams.files"),
      meta: { sortable: true, className: "tabular-nums" },
      cell: (c) => formatNumber(c.getValue(), locale),
    }),
    col.accessor("updated_at", {
      header: () => t("diagrams.updated"),
      meta: { sortable: true },
      cell: (c) => <RelativeTime value={c.getValue()} />,
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: (c) =>
        manage ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t("common.delete")}: ${c.row.original.name}`}
              onClick={() => setTarget(c.row.original)}
            >
              <Trash2Icon className="text-destructive" aria-hidden />
            </Button>
          </div>
        ) : null,
    }),
  ];

  const items = projects.data?.pages.flatMap((p) => p.items) ?? [];
  const clear = () => onSearchChange(search.sort ? { sort: search.sort } : {});
  const chips = [
    ...(search.q
      ? [
          {
            id: "q",
            name: t("common.search"),
            value: search.q,
            onRemove: () => onSearchChange({ ...search, q: undefined }),
          },
        ]
      : []),
    ...(search.owner
      ? [
          {
            id: "owner",
            name: t("diagrams.owner"),
            value: `@${search.owner}`,
            onRemove: () => onSearchChange({ ...search, owner: undefined }),
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        title={t("diagrams.title")}
        actions={
          can("templates.manage") ? (
            <Button asChild variant="outline">
              <Link to="/diagram-templates">
                <BoxesIcon aria-hidden />
                {t("diagrams.templates")}
              </Link>
            </Button>
          ) : null
        }
      />
      <Stats />
      <ListView
        query={projects}
        items={items}
        filtered={chips.length > 0}
        onClearFilters={clear}
        empty={{ title: t("diagrams.empty") }}
        toolbar={
          <>
            <search className="border-b border-border p-3 sm:p-4">
              <Label htmlFor="diagrams-q" className="sr-only">
                {t("common.search")}
              </Label>
              <SearchInput
                id="diagrams-q"
                className="max-w-md"
                placeholder={t("diagrams.search")}
                value={q}
                onValueChange={setQ}
              />
            </search>
            <FilterChips chips={chips} onReset={clear} />
          </>
        }
      >
        {(rows) => (
          <DataTable
            columns={columns}
            data={rows}
            caption={t("diagrams.title")}
            getRowId={(r) => r.id}
            sort={parseSort(search.sort)}
            onSortChange={(s) => onSearchChange({ ...search, sort: serializeSort(s) })}
            rowLabel={(r) => r.name}
            hotkeys
          />
        )}
      </ListView>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t("diagrams.deleteTitle", { name: target?.name ?? "" })}
        description={t("diagrams.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!target) return;
          await del.mutateAsync(target.id);
          notifySuccess(t("common.deleted"));
        }}
      />
    </>
  );
}
