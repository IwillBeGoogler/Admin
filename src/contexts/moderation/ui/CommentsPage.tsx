import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Can, usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { useSearchText } from "@/shared/lib/useSearchText";
import { BulkBar, useBulkRunner, useRowSelection } from "@/shared/ui/bulk-bar";
import { Button } from "@/shared/ui/button";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { FilterChips } from "@/shared/ui/filter-chips";
import { Label } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { SearchInput } from "@/shared/ui/search-input";
import { PageHeader } from "@/shared/ui/states";
import { useAdminComments, useDeleteComment } from "../application/hooks";
import { type Comment, type CommentsSearch, excerpt, matchesComment } from "../domain/comment";

const col = createColumnHelper<Features, Comment>();

export function CommentsPage({
  search = {},
  onSearchChange = () => {},
}: {
  search?: CommentsSearch;
  onSearchChange?: (s: CommentsSearch, opts?: { replace?: boolean }) => void;
}) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const comments = useAdminComments();
  const del = useDeleteComment();
  const [pending, setPending] = useState<Comment | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [q, setQ] = useSearchText(search.q, (v) => onSearchChange({ ...search, q: v }, { replace: true }));
  const [selected, setSelected] = useRowSelection(search.q);
  const runBulk = useBulkRunner<Comment>((c) => String(c.id), setSelected);
  const canDelete = can("comment.delete");

  const columns: Columns<Comment> = [
    col.accessor("text", {
      header: () => t("comments.text"),
      meta: { sortable: true },
      cell: (c) => (
        <p className="max-w-lg truncate" title={c.getValue()}>
          {excerpt(c.getValue())}
        </p>
      ),
    }),
    col.accessor("author", {
      header: () => t("comments.author"),
      meta: { sortable: true },
      cell: (c) => c.getValue() || "—",
    }),
    col.accessor("post_id", {
      header: () => t("comments.post"),
      meta: { sortable: true },
      cell: (c) => (
        <Link to="/posts/$postId" params={{ postId: c.getValue() }} className="tabular-nums hover:underline">
          #{c.getValue()}
        </Link>
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
        <Can code="comment.delete">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t("common.delete")}: #${c.row.original.id}`}
            onClick={() => setPending(c.row.original)}
          >
            <Trash2Icon className="text-destructive" aria-hidden />
          </Button>
        </Can>
      ),
    }),
  ];
  const loaded = comments.data?.pages.flatMap((p) => p.items) ?? [];
  const items = loaded.filter((c) => matchesComment(c, search.q));
  const selectedRows = items.filter((c) => selected.has(String(c.id)));
  const clear = () => onSearchChange(search.sort ? { sort: search.sort } : {});
  return (
    <>
      <PageHeader title={t("comments.title")} />
      <ListView
        query={comments}
        items={items}
        filtered={!!search.q}
        onClearFilters={clear}
        empty={{ title: t("comments.empty") }}
        toolbar={
          <>
            <search className="grid gap-1.5 border-b border-border p-3 sm:p-4">
              <Label htmlFor="comments-q" className="sr-only">
                {t("common.search")}
              </Label>
              <SearchInput
                id="comments-q"
                className="max-w-md"
                placeholder={t("confirm.searchComments")}
                aria-describedby="comments-q-hint"
                value={q}
                onValueChange={setQ}
              />
              <p id="comments-q-hint" className="text-xs text-muted-foreground">
                {t("list.filteredLoaded")}
              </p>
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
            caption={t("comments.title")}
            getRowId={(c) => String(c.id)}
            sort={parseSort(search.sort)}
            onSortChange={(s) => onSearchChange({ ...search, sort: serializeSort(s) })}
            selectable={canDelete}
            selected={selected}
            onSelectedChange={setSelected}
            rowLabel={(c) => `#${c.id}`}
            hotkeys
          />
        )}
      </ListView>
      <BulkBar count={selectedRows.length} onClear={() => setSelected(new Set())}>
        <Button variant="destructive" size="sm" onClick={() => setBulkOpen(true)}>
          <Trash2Icon aria-hidden />
          {t("common.delete")}
        </Button>
      </BulkBar>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={t("comments.deleteTitle")}
        description={pending ? `“${excerpt(pending.text, 80)}” — ${t("comments.deleteBody")}` : ""}
        confirmLabel={t("confirm.deleteComment")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!pending) return;
          await del.mutateAsync(pending.id);
          notifySuccess(t("confirm.commentDeleted", { id: pending.id }));
        }}
      />
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={t("confirm.bulkDeleteComments", { n: selectedRows.length })}
        description={t("confirm.bulkDeleteCommentsBody")}
        confirmLabel={t("confirm.deleteComments")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => runBulk(selectedRows, (c) => del.mutateAsync(c.id), "bulk.deleted")}
      />
    </>
  );
}
