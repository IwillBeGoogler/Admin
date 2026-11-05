import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { FilterChips } from "@/shared/ui/filter-chips";
import { Label, Select } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { PageHeader } from "@/shared/ui/states";
import { useBans, useLiftSanction } from "../application/hooks";
import { type BansSearch, type Sanction, sanctionKinds } from "../domain/sanction";

const col = createColumnHelper<Features, Sanction>();

export function BansPage({
  search = {},
  onSearchChange = () => {},
}: {
  search?: BansSearch;
  onSearchChange?: (s: BansSearch) => void;
}) {
  const { t } = useI18n();
  const bans = useBans();
  const lift = useLiftSanction();
  const [pending, setPending] = useState<Sanction | null>(null);
  const columns: Columns<Sanction> = [
    col.accessor("username", {
      header: () => t("bans.user"),
      meta: { sortable: true },
      cell: (c) => <span className="font-medium">@{c.getValue() || c.row.original.user_id}</span>,
    }),
    col.accessor("kind", {
      header: () => t("bans.kind"),
      meta: { sortable: true },
      cell: (c) => (
        <Badge variant={c.row.original.kind === "banned" ? "destructive" : "warning"}>
          {t(`bans.k.${c.row.original.kind}`)}
        </Badge>
      ),
    }),
    col.accessor("reason", {
      header: () => t("bans.reason"),
      cell: (c) => (
        <p className="max-w-sm truncate" title={c.getValue()}>
          {c.getValue()}
        </p>
      ),
    }),
    col.accessor("until", {
      header: () => t("bans.until"),
      meta: { sortable: true },
      cell: (c) => (c.getValue() ? <RelativeTime value={c.getValue()} /> : t("bans.forever")),
    }),
    col.accessor("created_at", {
      header: () => t("bans.since"),
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
            aria-label={`${t("users.unban")}: @${c.row.original.username}`}
            onClick={() => setPending(c.row.original)}
          >
            {t("users.unban")}
          </Button>
        </div>
      ),
    }),
  ];
  const loaded = bans.data?.pages.flatMap((p) => p.items) ?? [];
  const items = search.kind ? loaded.filter((s) => s.kind === search.kind) : loaded;
  const clear = () => onSearchChange(search.sort ? { sort: search.sort } : {});
  return (
    <>
      <PageHeader title={t("bans.title")} />
      <ListView
        query={bans}
        items={items}
        filtered={!!search.kind}
        onClearFilters={clear}
        empty={{ title: t("bans.empty") }}
        toolbar={
          <>
            <search className="flex flex-wrap items-end gap-3 border-b border-border p-3 sm:p-4">
              <div className="grid gap-1.5">
                <Label htmlFor="bans-kind">{t("bans.kind")}</Label>
                <Select
                  id="bans-kind"
                  className="w-44"
                  aria-describedby="bans-kind-hint"
                  value={search.kind ?? ""}
                  onChange={(e) =>
                    onSearchChange({
                      ...search,
                      kind: (sanctionKinds as readonly string[]).includes(e.target.value)
                        ? (e.target.value as BansSearch["kind"])
                        : undefined,
                    })
                  }
                >
                  <option value="">{t("confirm.bansKindAll")}</option>
                  {sanctionKinds.map((k) => (
                    <option key={k} value={k}>
                      {t(`bans.k.${k}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <p id="bans-kind-hint" className="pb-2 text-xs text-muted-foreground">
                {t("list.filteredLoaded")}
              </p>
            </search>
            <FilterChips
              chips={
                search.kind
                  ? [
                      {
                        id: "kind",
                        name: t("bans.kind"),
                        value: t(`bans.k.${search.kind}`),
                        onRemove: () => onSearchChange({ ...search, kind: undefined }),
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
            caption={t("bans.title")}
            getRowId={(s) => String(s.user_id)}
            sort={parseSort(search.sort)}
            onSortChange={(s) => onSearchChange({ ...search, sort: serializeSort(s) })}
            hotkeys
          />
        )}
      </ListView>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        variant="default"
        title={t("users.unbanTitle", { name: pending?.username ?? "" })}
        description={t("users.unbanBody")}
        confirmLabel={t("confirm.unban")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!pending) return;
          await lift.mutateAsync(pending.username);
          notifySuccess(t("users.lifted", { name: pending.username }));
        }}
      />
    </>
  );
}
