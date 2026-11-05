import { createColumnHelper } from "@tanstack/react-table";
import { BanIcon } from "lucide-react";
import { useState } from "react";
import { type User, usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { useSearchText } from "@/shared/lib/useSearchText";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import { FilterChips } from "@/shared/ui/filter-chips";
import { Label } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { SearchInput } from "@/shared/ui/search-input";
import { PageHeader } from "@/shared/ui/states";
import { useUsers } from "../application/hooks";
import { canSanction, type UsersSearch } from "../domain/sanction";
import { SanctionDialog } from "./SanctionDialog";

const col = createColumnHelper<Features, User>();

export function UsersPage({
  search,
  onSearchChange,
}: {
  search: UsersSearch;
  onSearchChange: (s: UsersSearch, opts?: { replace?: boolean }) => void;
}) {
  const { t } = useI18n();
  const { can, userId } = usePermissions();
  const [q, setQ] = useSearchText(search.q, (v) => onSearchChange({ ...search, q: v }, { replace: true }));
  const users = useUsers(search.q);
  const [target, setTarget] = useState<string | null>(null);

  const columns: Columns<User> = [
    col.accessor("username", {
      header: () => t("users.username"),
      meta: { sortable: true },
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium">@{c.getValue()}</span>
          {c.row.original.id === userId ? <Badge variant="outline">{t("users.self")}</Badge> : null}
          {c.row.original.display_name ? (
            <span className="max-w-48 truncate text-muted-foreground" title={c.row.original.display_name}>
              {c.row.original.display_name}
            </span>
          ) : null}
        </div>
      ),
    }),
    col.accessor("email", {
      header: () => t("users.email"),
      meta: { sortable: true },
      cell: (c) => (
        <span className="block max-w-64 truncate" title={c.getValue() || undefined}>
          {c.getValue() || "—"}
        </span>
      ),
    }),
    col.accessor("email_verified", {
      header: () => t("users.verified"),
      meta: { sortable: true },
      cell: (c) => (
        <Badge variant={c.getValue() ? "success" : "outline"}>{c.getValue() ? t("common.yes") : t("common.no")}</Badge>
      ),
    }),
    col.accessor("roles", {
      header: () => t("users.roles"),
      cell: (c) => (c.getValue()?.length ? c.getValue()?.join(", ") : "—"),
    }),
    col.accessor("created_at", {
      header: () => t("users.joined"),
      meta: { sortable: true },
      cell: (c) => <RelativeTime value={c.getValue()} />,
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: (c) =>
        can("user.ban") && canSanction(userId, c.row.original) ? (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              aria-label={`${t("users.ban")}: @${c.row.original.username}`}
              onClick={() => setTarget(c.row.original.username)}
            >
              <BanIcon aria-hidden />
              {t("users.ban")}
            </Button>
          </div>
        ) : null,
    }),
  ];
  const items = users.data?.pages.flatMap((p) => p.items) ?? [];
  const clear = () => onSearchChange(search.sort ? { sort: search.sort } : {});
  return (
    <>
      <PageHeader title={t("users.title")} />
      <ListView
        query={users}
        items={items}
        filtered={!!search.q}
        onClearFilters={clear}
        empty={{ title: t("users.empty") }}
        toolbar={
          <>
            <search className="border-b border-border p-3 sm:p-4">
              <Label htmlFor="users-q" className="sr-only">
                {t("common.search")}
              </Label>
              <SearchInput
                id="users-q"
                className="max-w-md"
                placeholder={t("users.search")}
                value={q}
                onValueChange={setQ}
              />
            </search>
            <FilterChips
              chips={
                search.q
                  ? [
                      {
                        id: "q",
                        name: t("common.search"),
                        value: search.q,
                        onRemove: () => onSearchChange({ ...search, q: undefined }),
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
            caption={t("users.title")}
            getRowId={(u) => String(u.id)}
            sort={parseSort(search.sort)}
            onSortChange={(s) => onSearchChange({ ...search, sort: serializeSort(s) })}
            hotkeys
          />
        )}
      </ListView>
      {target ? <SanctionDialog key={target} username={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}
