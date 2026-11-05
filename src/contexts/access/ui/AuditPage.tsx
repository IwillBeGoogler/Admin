import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import { FilterChips } from "@/shared/ui/filter-chips";
import { Input, Label, Select } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { PageHeader } from "@/shared/ui/states";
import { useAudit } from "../application/hooks";
import type { AuditEvent, AuditSearch } from "../domain/access";

const col = createColumnHelper<Features, AuditEvent>();

export function AuditPage({
  search,
  onSearchChange,
}: {
  search: AuditSearch;
  onSearchChange: (s: AuditSearch) => void;
}) {
  const { t } = useI18n();
  const { sort, ...query } = search;
  const q = useAudit(query);
  const [actor, setActor] = useState(search.actor ?? "");
  const [seenActor, setSeenActor] = useState(search.actor);
  if (seenActor !== search.actor) {
    setSeenActor(search.actor);
    setActor(search.actor ?? "");
  }

  const columns: Columns<AuditEvent> = [
    col.accessor("occurred_at", {
      header: () => t("audit.when"),
      meta: { sortable: true },
      cell: (c) => <RelativeTime value={c.getValue()} />,
    }),
    col.accessor("action", {
      header: () => t("audit.action"),
      meta: { sortable: true },
      cell: (c) => (
        <>
          <code>{c.getValue()}</code>
          {Object.keys(c.row.original.metadata).length ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">metadata</summary>
              <pre className="whitespace-pre-wrap">{JSON.stringify(c.row.original.metadata, null, 2)}</pre>
            </details>
          ) : null}
        </>
      ),
    }),
    col.accessor("actor_id", {
      header: () => t("audit.actor"),
      meta: { sortable: true, className: "tabular-nums" },
      cell: (c) => c.getValue() || "—",
    }),
    col.accessor("target", {
      header: () => t("audit.target"),
      meta: { sortable: true },
      cell: (c) => (
        <span className="block max-w-56 truncate" title={c.getValue() || undefined}>
          {c.getValue() || "—"}
        </span>
      ),
    }),
    col.accessor("success", {
      header: () => t("audit.result"),
      meta: { sortable: true },
      cell: (c) => (
        <Badge variant={c.getValue() ? "success" : "destructive"}>
          {c.getValue() ? t("audit.ok") : t("audit.failed")}
        </Badge>
      ),
    }),
    col.accessor("ip", { header: () => t("audit.ip"), cell: (c) => <code>{c.getValue() || "—"}</code> }),
  ];

  const clear = () => onSearchChange({ limit: search.limit, ...(sort ? { sort } : {}) });
  return (
    <>
      <PageHeader title={t("audit.title")} />
      <ListView
        query={q}
        items={q.data ?? []}
        filtered={!!search.actor}
        onClearFilters={clear}
        empty={{ title: t("audit.empty") }}
        toolbar={
          <>
            <form
              className="flex flex-wrap items-end gap-3 border-b border-border p-3 sm:p-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSearchChange({ ...search, actor: actor.trim() || undefined });
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="audit-actor">{t("audit.actorFilter")}</Label>
                <Input
                  id="audit-actor"
                  inputMode="numeric"
                  className="w-40"
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="audit-limit">{t("audit.limit")}</Label>
                <Select
                  id="audit-limit"
                  className="w-28"
                  value={search.limit}
                  onChange={(e) => onSearchChange({ ...search, limit: Number(e.target.value) })}
                >
                  {[50, 100, 200, 500].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="outline">
                {t("common.search")}
              </Button>
            </form>
            <FilterChips
              chips={
                search.actor
                  ? [
                      {
                        id: "actor",
                        name: t("audit.actorFilter"),
                        value: search.actor,
                        onRemove: () => onSearchChange({ ...search, actor: undefined }),
                      },
                    ]
                  : []
              }
              onReset={clear}
            />
          </>
        }
      >
        {(rows) => (
          <DataTable
            columns={columns}
            data={rows}
            caption={t("audit.title")}
            getRowId={(e) => e.id}
            sort={parseSort(sort)}
            onSortChange={(s) => onSearchChange({ ...search, sort: serializeSort(s) })}
            hotkeys
          />
        )}
      </ListView>
    </>
  );
}
