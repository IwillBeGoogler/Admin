import { Link, useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Can, usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/lib/format";
import { notifySuccess } from "@/shared/lib/notify";
import { key } from "@/shared/lib/shortcuts";
import { parseSort, serializeSort } from "@/shared/lib/sort";
import { useHotkeys } from "@/shared/lib/useHotkeys";
import { useSearchText } from "@/shared/lib/useSearchText";
import { BulkBar, useBulkRunner, useRowSelection } from "@/shared/ui/bulk-bar";
import { Button } from "@/shared/ui/button";
import { type Columns, DataTable, type Features } from "@/shared/ui/data-table";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { type FilterChip, FilterChips } from "@/shared/ui/filter-chips";
import { Label, Select } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { SearchInput } from "@/shared/ui/search-input";
import { PageHeader } from "@/shared/ui/states";
import { useCategories, useDeletePost, useLabels, usePosts } from "../application/hooks";
import { type Post, type PostFilters, type PostSource, postSources } from "../domain/post";
import { StatusBadge } from "./StatusBadge";

const col = createColumnHelper<Features, Post>();

export function PostsPage({
  filters,
  onFiltersChange,
}: {
  filters: PostFilters;
  onFiltersChange: (f: PostFilters, opts?: { replace?: boolean }) => void;
}) {
  const { t, locale } = useI18n();
  const { can, userId } = usePermissions();
  const navigate = useNavigate();
  const set = (patch: Partial<PostFilters>) => onFiltersChange({ ...filters, ...patch });
  const [q, setQ] = useSearchText(filters.q, (v) => onFiltersChange({ ...filters, q: v }, { replace: true }));

  const { sort: sortParam, ...query } = filters;
  const sort = parseSort(sortParam);
  const posts = usePosts(query);
  const categories = useCategories();
  const labels = useLabels();
  const del = useDeletePost();
  const [pending, setPending] = useState<Post | null>(null);
  const [selected, setSelected] = useRowSelection(query);
  const [bulkOpen, setBulkOpen] = useState(false);
  const runBulk = useBulkRunner<Post>((p) => String(p.id), setSelected);
  const own = filters.source === "draft" || filters.source === "scheduled";
  const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const labelName = new Map((labels.data ?? []).map((l) => [l.id, l.name]));
  /** Same rule as the row's delete button. */
  const canDelete = (p: Post) => can("post.delete") || p.user_id === userId;

  useHotkeys({ [key("newItem")]: can("post.create") ? () => void navigate({ to: "/posts/new" }) : null });

  const columns: Columns<Post> = [
    col.accessor("title", {
      header: () => t("posts.titleField"),
      meta: { sortable: true },
      cell: (c) => (
        <div className="grid max-w-md gap-0.5">
          <Link
            to="/posts/$postId"
            params={{ postId: c.row.original.id }}
            className="truncate font-medium hover:underline"
            title={c.getValue()}
          >
            {c.getValue()}
          </Link>
          {c.row.original.tags?.length ? (
            <span className="truncate text-xs text-muted-foreground">#{c.row.original.tags.join(" #")}</span>
          ) : null}
        </div>
      ),
    }),
    col.accessor("status", {
      header: () => t("posts.status"),
      meta: { sortable: true },
      cell: (c) => <StatusBadge status={c.getValue()} />,
    }),
    col.accessor("author", {
      header: () => t("posts.author"),
      meta: { sortable: true },
      cell: (c) => `@${c.getValue()}`,
    }),
    col.accessor("category_id", {
      header: () => t("posts.category"),
      meta: { sortable: true, sortValue: (p: Post) => catName.get(p.category_id) },
      cell: (c) => catName.get(c.getValue()) ?? "—",
    }),
    col.accessor("published_at", {
      header: () => t("posts.published"),
      meta: { sortable: true, sortValue: (p: Post) => p.published_at ?? p.publish_at },
      cell: (c) => <RelativeTime value={c.getValue() ?? c.row.original.publish_at} />,
    }),
    col.accessor("views", {
      header: () => t("posts.views"),
      meta: { sortable: true, className: "text-right tabular-nums" },
      cell: (c) => formatNumber(c.getValue(), locale),
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon" aria-label={`${t("common.edit")}: ${c.row.original.title}`}>
            <Link to="/posts/$postId" params={{ postId: c.row.original.id }}>
              <PencilIcon aria-hidden />
            </Link>
          </Button>
          {canDelete(c.row.original) ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t("common.delete")}: ${c.row.original.title}`}
              onClick={() => setPending(c.row.original)}
            >
              <Trash2Icon className="text-destructive" aria-hidden />
            </Button>
          ) : null}
        </div>
      ),
    }),
  ];

  const items = posts.data?.pages.flatMap((p) => p.items) ?? [];
  const selectedRows = items.filter((p) => selected.has(String(p.id)) && canDelete(p));
  const sourceLabel = (s: PostSource) =>
    t(s === "public" ? "posts.sourcePublic" : s === "draft" ? "posts.sourceDraft" : "posts.sourceScheduled");
  const chips = (
    [
      filters.q ? { id: "q", name: t("common.search"), value: filters.q, onRemove: () => set({ q: undefined }) } : null,
      filters.source
        ? {
            id: "source",
            name: t("posts.source"),
            value: sourceLabel(filters.source),
            onRemove: () => set({ source: undefined }),
          }
        : null,
      filters.category
        ? {
            id: "category",
            name: t("posts.category"),
            value: catName.get(filters.category) ?? `#${filters.category}`,
            onRemove: () => set({ category: undefined }),
          }
        : null,
      filters.label
        ? {
            id: "label",
            name: t("posts.label"),
            value: labelName.get(filters.label) ?? `#${filters.label}`,
            onRemove: () => set({ label: undefined }),
          }
        : null,
      filters.tag
        ? { id: "tag", name: t("posts.tag"), value: `#${filters.tag}`, onRemove: () => set({ tag: undefined }) }
        : null,
    ] as (FilterChip | null)[]
  ).filter((c): c is FilterChip => c !== null);
  const clearFilters = () => onFiltersChange(sortParam ? { sort: sortParam } : {});

  return (
    <>
      <PageHeader
        title={t("posts.title")}
        actions={
          <Can code="post.create">
            <Button asChild>
              <Link to="/posts/new">
                <PlusIcon aria-hidden />
                {t("posts.new")}
              </Link>
            </Button>
          </Can>
        }
      />
      <ListView
        query={posts}
        items={items}
        filtered={chips.length > 0}
        onClearFilters={clearFilters}
        empty={{
          title: t("posts.empty"),
          hint: can("post.create") ? t("confirm.createFirstPost") : undefined,
          action: can("post.create") ? (
            <Button asChild size="sm">
              <Link to="/posts/new">
                <PlusIcon aria-hidden />
                {t("posts.new")}
              </Link>
            </Button>
          ) : undefined,
        }}
        toolbar={
          <>
            <search className="grid gap-3 border-b border-border p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-5">
              <div className="grid gap-1.5 lg:col-span-2">
                <Label htmlFor="posts-q">{t("common.search")}</Label>
                <SearchInput
                  id="posts-q"
                  placeholder={t("posts.search")}
                  value={q}
                  disabled={own}
                  aria-describedby={own ? "posts-own-hint" : undefined}
                  onValueChange={setQ}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="posts-source">{t("posts.source")}</Label>
                <Select
                  id="posts-source"
                  value={filters.source ?? "public"}
                  onChange={(e) =>
                    set({ source: e.target.value === "public" ? undefined : (e.target.value as PostSource) })
                  }
                >
                  {postSources.map((s) => (
                    <option key={s} value={s}>
                      {sourceLabel(s)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="posts-category">{t("posts.category")}</Label>
                <Select
                  id="posts-category"
                  disabled={own}
                  aria-describedby={own ? "posts-own-hint" : undefined}
                  value={filters.category ?? ""}
                  onChange={(e) => set({ category: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">{t("common.all")}</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="posts-label">{t("posts.label")}</Label>
                <Select
                  id="posts-label"
                  disabled={own}
                  aria-describedby={own ? "posts-own-hint" : undefined}
                  value={filters.label ?? ""}
                  onChange={(e) => set({ label: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">{t("common.all")}</option>
                  {labels.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              {own ? (
                <p id="posts-own-hint" className="text-xs text-muted-foreground lg:col-span-5">
                  {t("confirm.ownHint")}
                </p>
              ) : null}
            </search>
            <FilterChips chips={chips} onReset={clearFilters} />
          </>
        }
      >
        {(rows) => (
          <DataTable
            columns={columns}
            data={rows}
            caption={t("posts.title")}
            getRowId={(p) => String(p.id)}
            sort={sort}
            onSortChange={(s) => onFiltersChange({ ...filters, sort: serializeSort(s) })}
            selectable
            canSelect={canDelete}
            selected={selected}
            onSelectedChange={setSelected}
            rowLabel={(p) => p.title}
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
        title={t("posts.deleteTitle")}
        description={t("posts.deleteBody", { title: pending?.title ?? "" })}
        confirmLabel={t("confirm.deletePost")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!pending) return;
          await del.mutateAsync(pending.id);
          notifySuccess(t("confirm.postDeleted", { title: pending.title }));
        }}
      />
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={t("confirm.bulkDeletePosts", { n: selectedRows.length })}
        description={t("confirm.bulkDeletePostsBody")}
        confirmLabel={t("confirm.deletePosts")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => runBulk(selectedRows, (p) => del.mutateAsync(p.id), "bulk.deleted")}
      />
    </>
  );
}
