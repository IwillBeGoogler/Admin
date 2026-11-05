import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useBlocker } from "@tanstack/react-router";
import { ArrowLeftIcon, HistoryIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { isApiError } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/lib/format";
import { notifyError, notifySuccess } from "@/shared/lib/notify";
import { key } from "@/shared/lib/shortcuts";
import { useHotkeys } from "@/shared/lib/useHotkeys";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle, PendingLabel } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState, LoadingRows, PageHeader } from "@/shared/ui/states";
import {
  useCategories,
  useLabels,
  usePost,
  useRestoreRevision,
  useRevision,
  useRevisions,
  useSavePost,
} from "../application/hooks";
import {
  emptyPostForm,
  type Post,
  type PostForm,
  postFormBase,
  postFormSchema,
  postStatuses,
  postToForm,
  toDraftPayload,
} from "../domain/post";
import type { DiffOp } from "../domain/revision";
import { diffStats } from "../domain/revision";
import { StatusBadge } from "./StatusBadge";

export function PostEditorPage({ postId, onSaved }: { postId?: number; onSaved: (id: number) => void }) {
  const { t } = useI18n();
  const post = usePost(postId);
  const back = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/posts">
        <ArrowLeftIcon aria-hidden />
        {t("common.back")}
      </Link>
    </Button>
  );
  if (postId !== undefined && post.isPending)
    return (
      <div className="grid gap-4" role="status" aria-label={t("common.loading")}>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  if (postId !== undefined && post.isError)
    return <ErrorState error={post.error} onRetry={() => void post.refetch()} />;
  return (
    <>
      <PageHeader title={postId === undefined ? t("posts.new") : t("posts.editTitle")} actions={back} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* key: a restored revision remounts the form with fresh values */}
        <EditorForm key={post.data?.updated_at ?? "new"} post={post.data} onSaved={onSaved} />
        {post.data ? <RevisionsPanel post={post.data} /> : null}
      </div>
    </>
  );
}

function EditorForm({ post, onSaved }: { post: Post | undefined; onSaved: (id: number) => void }) {
  const { t } = useI18n();
  const categories = useCategories();
  const labels = useLabels();
  const save = useSavePost(post?.id);
  const form = useForm<PostForm>({
    resolver: async (values, ctx, opts) => zodResolver(postFormSchema(new Date()))(values, ctx, opts),
    defaultValues: post ? postToForm(post) : emptyPostForm(),
  });
  const e = form.formState.errors;
  const msg = (k?: string) => (k ? t(k as MessageKey) : undefined);
  const status = form.watch("status");
  const dirty = form.formState.isDirty;
  /** Set once a save succeeds so the follow-up navigation is not blocked. */
  const saved = useRef(false);

  const submit = form.handleSubmit((v) =>
    save.mutate(toDraftPayload(postFormBase.parse(v)), {
      onSuccess: (p) => {
        saved.current = true;
        notifySuccess(t(post ? "posts.updated" : "posts.created"));
        onSaved(p.id);
      },
      onError: (err) => {
        // Validation problems stay inline; only unexpected failures toast.
        if (isApiError(err) && err.status === 400) form.setError("root", { message: err.message });
        else notifyError(err);
      },
    }),
  );

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !saved.current,
    enableBeforeUnload: () => dirty && !saved.current,
    withResolver: true,
  });

  useHotkeys({
    [key("save")]: { allowInInput: true, handler: () => void submit() },
    [key("publish")]: {
      allowInInput: true,
      handler: () => {
        form.setValue("status", "published", { shouldDirty: true });
        void submit();
      },
    },
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field label={t("posts.titleField")} error={msg(e.title?.message)}>
            {(a) => <Input {...a} {...form.register("title")} />}
          </Field>
          <Field label={t("posts.subtitle")} error={msg(e.subtitle?.message)}>
            {(a) => <Input {...a} {...form.register("subtitle")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("posts.status")}>
              {(a) => (
                <Select {...a} {...form.register("status")}>
                  {postStatuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`posts.s.${s}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {status === "scheduled" ? (
              <Field label={t("posts.publishAt")} error={msg(e.publishAt?.message)}>
                {(a) => <Input {...a} type="datetime-local" {...form.register("publishAt")} />}
              </Field>
            ) : null}
            <Field label={t("posts.category")}>
              {(a) => (
                <Select {...a} {...form.register("categoryId", { valueAsNumber: true })}>
                  <option value={0}>{t("posts.noCategory")}</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("posts.tags")} error={msg(e.tags?.message)}>
              {(a) => <Input {...a} placeholder="go, docker" {...form.register("tags")} />}
            </Field>
          </div>
          {labels.data?.length ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{t("posts.labels")}</legend>
              <Controller
                control={form.control}
                name="labelIds"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-3">
                    {labels.data.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value.includes(l.id)}
                          onChange={(ev) =>
                            field.onChange(
                              ev.target.checked ? [...field.value, l.id] : field.value.filter((x) => x !== l.id),
                            )
                          }
                        />
                        <span className="size-3 rounded-full" style={{ background: l.color }} aria-hidden />
                        {l.name}
                      </label>
                    ))}
                  </div>
                )}
              />
              {e.labelIds?.message ? (
                <p role="alert" className="text-xs text-destructive">
                  {msg(e.labelIds.message)}
                </p>
              ) : null}
            </fieldset>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("posts.coverUrl")} error={msg(e.coverUrl?.message)}>
              {(a) => <Input {...a} type="url" inputMode="url" {...form.register("coverUrl")} />}
            </Field>
            <Field label={t("posts.canonicalUrl")} error={msg(e.canonicalUrl?.message)}>
              {(a) => <Input {...a} type="url" inputMode="url" {...form.register("canonicalUrl")} />}
            </Field>
          </div>
          <Field label={t("posts.body")} error={msg(e.body?.message)}>
            {(a) => <Textarea {...a} rows={16} className="font-mono" {...form.register("body")} />}
          </Field>
          {e.root?.message ? (
            <p role="alert" className="text-sm text-destructive">
              {e.root.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={save.isPending} aria-busy={save.isPending || undefined}>
              <PendingLabel pending={save.isPending}>{post ? t("common.save") : t("common.create")}</PendingLabel>
            </Button>
          </div>
        </form>
      </CardContent>
      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(o) => !o && blocker.status === "blocked" && blocker.reset()}
        title={t("editor.discardTitle")}
        description={t("editor.discardBody")}
        confirmLabel={t("editor.discard")}
        cancelLabel={t("editor.keepEditing")}
        onConfirm={() => blocker.status === "blocked" && blocker.proceed()}
      />
    </Card>
  );
}

const opClass: Record<DiffOp["op"], string> = {
  "=": "text-muted-foreground",
  "-": "bg-destructive/10 text-destructive line-through decoration-destructive/40",
  "+": "bg-success/10 text-success",
};

function DiffView({ label, ops }: { label: string; ops: DiffOp[] }) {
  if (!ops.length) return null;
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-72 overflow-auto rounded-md border border-border p-2 text-xs leading-relaxed whitespace-pre-wrap">
        {ops.map((o, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are positional
          <div key={i} className={opClass[o.op]}>
            <span aria-hidden className="select-none pr-2">
              {o.op === "=" ? " " : o.op}
            </span>
            <span className="sr-only">{o.op === "+" ? "added" : o.op === "-" ? "removed" : ""}</span>
            {o.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

function RevisionsPanel({ post }: { post: Post }) {
  const { t, locale } = useI18n();
  const revisions = useRevisions(post.id);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const detail = useRevision(post.id, open);
  const restore = useRestoreRevision(post.id);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="size-4" aria-hidden />
          {t("posts.revisions")}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={post.status} /> {formatDate(post.updated_at, locale)}
        </div>
      </CardHeader>
      <CardContent>
        <ListView bare query={revisions} items={revisions.data ?? []} empty={{ title: t("posts.noRevisions") }}>
          {(rows) => (
            <ul className="grid gap-1">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(r.version)}
                    className="grid w-full gap-0.5 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">
                      {t("posts.version", { v: r.version })} · {r.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      @{r.editor || "—"} · {formatDate(r.created_at, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ListView>
      </CardContent>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl" closeLabel={t("common.close")}>
          <DialogTitle>{t("posts.version", { v: open ?? 0 })}</DialogTitle>
          <DialogDescription>
            {detail.data
              ? `+${diffStats(detail.data.diff.body).added + diffStats(detail.data.diff.title).added} / −${diffStats(detail.data.diff.body).removed + diffStats(detail.data.diff.title).removed}`
              : t("common.loading")}
          </DialogDescription>
          {detail.isError ? <ErrorState error={detail.error} /> : null}
          {detail.data ? (
            <div className="grid gap-3">
              <DiffView label={t("posts.titleField")} ops={detail.data.diff.title} />
              <DiffView label={t("posts.subtitle")} ops={detail.data.diff.subtitle} />
              <DiffView label={t("posts.body")} ops={detail.data.diff.body} />
              <div className="flex justify-end">
                <Button onClick={() => setConfirm(true)}>{t("posts.restore")}</Button>
              </div>
            </div>
          ) : (
            <LoadingRows rows={4} />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("posts.restoreTitle", { v: open ?? 0 })}
        description={t("posts.restoreBody")}
        confirmLabel={t("posts.restore")}
        cancelLabel={t("common.cancel")}
        variant="default"
        onConfirm={async () => {
          if (open === null) return;
          await restore.mutateAsync(open);
          notifySuccess(t("posts.restored", { v: open }));
          setOpen(null);
          void revisions.refetch();
        }}
      />
    </Card>
  );
}
