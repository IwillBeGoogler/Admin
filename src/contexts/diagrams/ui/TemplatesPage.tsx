import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { isApiError } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { notifyError, notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  PendingLabel,
} from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import {
  useCreateTemplate,
  useDeleteTemplate,
  useReorderTemplates,
  useTemplates,
  useUpdateTemplate,
} from "../application/hooks";
import { nextPosition, type Template, type TemplateInput, templateInputSchema, templateKinds } from "../domain/diagram";

export function TemplatesPage() {
  const { t } = useI18n();
  const q = useTemplates();
  const update = useUpdateTemplate();
  const reorder = useReorderTemplates();
  const del = useDeleteTemplate();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const items = q.data ?? [];

  const togglePublished = (tpl: Template) =>
    update.mutate(
      { id: tpl.id, published: !tpl.published },
      {
        onSuccess: () => notifySuccess(t("common.saved")),
        onError: (e) => notifyError(e),
      },
    );
  /** Swap with the neighbour and send the whole order at once (atomic, ties renumbered by the server). */
  const move = async (i: number, dir: -1 | 1) => {
    const ids = items.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
    try {
      await reorder.mutateAsync(ids);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <>
      <PageHeader
        title={t("templates.title")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <PlusIcon aria-hidden />
            {t("templates.new")}
          </Button>
        }
      />
      <ListView query={q} items={items} empty={{ title: t("templates.empty") }}>
        {(rows) => (
          <Table>
            <caption className="sr-only">{t("templates.title")}</caption>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>{t("templates.name")}</TH>
                <TH>{t("diagrams.type")}</TH>
                <TH>{t("templates.fileId")}</TH>
                <TH>{t("templates.published")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((tpl, i) => (
                <TR key={tpl.id}>
                  <TD className="tabular-nums text-muted-foreground">{tpl.position}</TD>
                  <TD>
                    <div className="grid">
                      <span className="font-medium">{tpl.title}</span>
                      {tpl.description ? (
                        <span className="max-w-md truncate text-xs text-muted-foreground" title={tpl.description}>
                          {tpl.description}
                        </span>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    <Badge variant="outline">{t(`templates.kind.${tpl.kind}`)}</Badge>
                  </TD>
                  <TD className="font-mono text-xs">{tpl.file_id}</TD>
                  <TD>
                    <Button
                      size="sm"
                      variant={tpl.published ? "secondary" : "outline"}
                      aria-pressed={tpl.published}
                      aria-label={`${t("templates.published")}: ${tpl.title}`}
                      disabled={update.isPending}
                      onClick={() => togglePublished(tpl)}
                    >
                      {tpl.published ? t("common.yes") : t("common.no")}
                    </Button>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("templates.moveUp")}: ${tpl.title}`}
                        disabled={i === 0 || update.isPending}
                        onClick={() => void move(i, -1)}
                      >
                        <ArrowUpIcon aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("templates.moveDown")}: ${tpl.title}`}
                        disabled={i === rows.length - 1 || update.isPending}
                        onClick={() => void move(i, 1)}
                      >
                        <ArrowDownIcon aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("common.edit")}: ${tpl.title}`}
                        onClick={() => setEditing(tpl)}
                      >
                        <PencilIcon aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("common.delete")}: ${tpl.title}`}
                        onClick={() => setDeleting(tpl)}
                      >
                        <Trash2Icon className="text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </ListView>
      {editing ? (
        <TemplateDialog
          key={editing === "new" ? "new" : editing.id}
          template={editing === "new" ? null : editing}
          position={nextPosition(items)}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("templates.deleteTitle", { name: deleting?.title ?? "" })}
        description={t("templates.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!deleting) return;
          await del.mutateAsync(deleting.id);
          notifySuccess(t("common.deleted"));
        }}
      />
    </>
  );
}

function TemplateDialog({
  template,
  position,
  onClose,
}: {
  template: Template | null;
  position: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const pending = create.isPending || update.isPending;
  const form = useForm<TemplateInput>({
    resolver: zodResolver(templateInputSchema),
    defaultValues: template
      ? {
          title: template.title,
          kind: template.kind,
          description: template.description,
          file_id: template.file_id,
          published: template.published,
        }
      : { title: "", kind: "system", description: "", file_id: "", published: false },
  });
  const e = form.formState.errors;
  const msg = (m?: string) => (m ? t(m as MessageKey) : undefined);
  const submit = form.handleSubmit(async (v) => {
    try {
      if (template) await update.mutateAsync({ id: template.id, ...v });
      else await create.mutateAsync({ ...v, position });
      notifySuccess(t("common.saved"));
      onClose();
    } catch (err) {
      if (isApiError(err) && err.status < 500) form.setError("root", { message: err.message });
      else notifyError(err);
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent closeLabel={t("common.close")} locked={pending}>
        <DialogTitle>{template ? t("templates.edit") : t("templates.new")}</DialogTitle>
        <DialogDescription>{t("templates.hint")}</DialogDescription>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field label={t("templates.name")} error={msg(e.title?.message)}>
            {(a) => <Input {...a} maxLength={120} {...form.register("title")} />}
          </Field>
          <Field label={t("diagrams.type")} error={msg(e.kind?.message)}>
            {(a) => (
              <Select {...a} {...form.register("kind")}>
                {templateKinds.map((k) => (
                  <option key={k} value={k}>
                    {t(`templates.kind.${k}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("templates.description")} error={msg(e.description?.message)}>
            {(a) => <Textarea {...a} rows={3} maxLength={500} {...form.register("description")} />}
          </Field>
          <Field label={t("templates.fileId")} hint={t("templates.fileIdHint")} error={msg(e.file_id?.message)}>
            {(a) => <Input {...a} className="font-mono" {...form.register("file_id")} />}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox {...form.register("published")} />
            {t("templates.published")}
          </label>
          {e.root?.message ? (
            <p role="alert" className="text-sm text-destructive">
              {e.root.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
              <PendingLabel pending={pending}>{t("common.save")}</PendingLabel>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
