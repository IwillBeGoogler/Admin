import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { errorMessage } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/lib/format";
import { notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import {
  useCategories,
  useCreateCategory,
  useCreateLabel,
  useDeleteCategory,
  useDeleteLabel,
  useLabels,
  useTags,
} from "../application/hooks";
import { type CategoryInput, categoryInputSchema, type LabelInput, labelInputSchema } from "../domain/taxonomy";

function useDeleteConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, ask: setTarget, close: () => setTarget(null) };
}

export function CategoriesPage() {
  const { t, locale } = useI18n();
  const q = useCategories();
  const create = useCreateCategory();
  const del = useDeleteCategory();
  const confirm = useDeleteConfirm<{ id: number; name: string }>();
  const form = useForm<CategoryInput>({ resolver: zodResolver(categoryInputSchema), defaultValues: { name: "" } });
  const err = form.formState.errors.name?.message;
  const submit = form.handleSubmit((v) =>
    create.mutate(v.name, {
      onSuccess: () => {
        notifySuccess(t("common.saved"));
        form.reset();
      },
      onError: (e) => form.setError("name", { message: errorMessage(e) }),
    }),
  );
  return (
    <>
      <PageHeader title={t("categories.title")} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardContent className="pt-5">
            <form onSubmit={submit} noValidate className="grid gap-3">
              <Field label={t("categories.new")} error={err && t(err as MessageKey)}>
                {(a) => <Input {...a} {...form.register("name")} />}
              </Field>
              <Button type="submit" disabled={create.isPending}>
                <PlusIcon aria-hidden />
                {t("common.create")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <ListView query={q} items={q.data ?? []} empty={{ title: t("categories.empty") }}>
          {(rows) => (
            <Table>
              <caption className="sr-only">{t("categories.title")}</caption>
              <THead>
                <TR>
                  <TH>{t("common.name")}</TH>
                  <TH>{t("categories.posts")}</TH>
                  <TH>
                    <span className="sr-only">{t("common.actions")}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link to="/posts" search={{ category: c.id }} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="tabular-nums">{formatNumber(c.count, locale)}</TD>
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("common.delete")}: ${c.name}`}
                        onClick={() => confirm.ask(c)}
                      >
                        <Trash2Icon className="text-destructive" aria-hidden />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </ListView>
      </div>
      <ConfirmDialog
        open={confirm.target !== null}
        onOpenChange={(o) => !o && confirm.close()}
        title={t("categories.deleteTitle")}
        description={`${confirm.target?.name ?? ""} — ${t("categories.deleteBody")}`}
        confirmLabel={t("confirm.deleteCategory")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          const target = confirm.target;
          if (!target) return;
          await del.mutateAsync(target.id);
          notifySuccess(t("confirm.categoryDeleted", { name: target.name }));
        }}
      />
    </>
  );
}

export function LabelsPage() {
  const { t } = useI18n();
  const q = useLabels();
  const create = useCreateLabel();
  const del = useDeleteLabel();
  const confirm = useDeleteConfirm<{ id: number; name: string }>();
  const form = useForm<LabelInput, unknown, { name: string; color: string }>({
    resolver: zodResolver(labelInputSchema),
    defaultValues: { name: "", color: "#3b82f6" },
  });
  const e = form.formState.errors;
  /** Zod messages are i18n keys; server messages fall through translate unchanged. */
  const msg = (m?: string) => (m ? t(m as MessageKey) : undefined);
  const color = form.watch("color");
  const submit = form.handleSubmit((v) =>
    create.mutate(v, {
      onSuccess: () => {
        notifySuccess(t("common.saved"));
        form.reset({ name: "", color: v.color });
      },
      onError: (er) => form.setError("name", { message: errorMessage(er) }),
    }),
  );
  return (
    <>
      <PageHeader title={t("labels.title")} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardContent className="pt-5">
            <form onSubmit={submit} noValidate className="grid gap-3">
              <Field label={t("labels.new")} error={msg(e.name?.message)}>
                {(a) => <Input {...a} {...form.register("name")} />}
              </Field>
              <Field label={t("labels.color")} error={msg(e.color?.message)}>
                {(a) => (
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label={t("labels.color")}
                      className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                      value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"}
                      onChange={(ev) => form.setValue("color", ev.target.value, { shouldValidate: true })}
                    />
                    <Input {...a} {...form.register("color")} className="font-mono" />
                  </div>
                )}
              </Field>
              <Button type="submit" disabled={create.isPending}>
                <PlusIcon aria-hidden />
                {t("common.create")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <ListView query={q} items={q.data ?? []} empty={{ title: t("labels.empty") }}>
          {(rows) => (
            <ul className="divide-y divide-border">
              {rows.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className="size-4 shrink-0 rounded-full border border-border"
                    style={{ background: l.color }}
                    aria-hidden
                  />
                  <Link to="/posts" search={{ label: l.id }} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <code className="text-xs text-muted-foreground">{l.color}</code>
                  <Button
                    className="ml-auto"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("common.delete")}: ${l.name}`}
                    onClick={() => confirm.ask(l)}
                  >
                    <Trash2Icon className="text-destructive" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ListView>
      </div>
      <ConfirmDialog
        open={confirm.target !== null}
        onOpenChange={(o) => !o && confirm.close()}
        title={t("labels.deleteTitle")}
        description={`${confirm.target?.name ?? ""} — ${t("labels.deleteBody")}`}
        confirmLabel={t("confirm.deleteLabel")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          const target = confirm.target;
          if (!target) return;
          await del.mutateAsync(target.id);
          notifySuccess(t("confirm.labelDeleted", { name: target.name }));
        }}
      />
    </>
  );
}

export function TagsPage() {
  const { t, locale } = useI18n();
  const q = useTags();
  return (
    <>
      <PageHeader title={t("tags.title")} description={t("tags.hint")} />
      <ListView query={q} items={q.data ?? []} empty={{ title: t("tags.empty") }}>
        {(rows) => (
          <ul className="flex flex-wrap gap-2 p-4">
            {rows.map((tag) => (
              <li key={tag.name}>
                <Link
                  to="/posts"
                  search={{ tag: tag.name }}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
                >
                  #{tag.name}
                  <Badge variant="secondary">{formatNumber(tag.count, locale)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ListView>
    </>
  );
}
