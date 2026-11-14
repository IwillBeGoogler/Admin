import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { errorMessage } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Input, Select, Textarea } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import { useDeleteGlossaryTerm, useGlossary, useSaveGlossaryTerm } from "../application/hooks";
import {
  type GlossaryForm,
  type GlossaryTerm,
  glossaryFormSchema,
  glossaryLangs,
  toForm,
  toPayload,
} from "../domain/glossary";

const empty: GlossaryForm = { term: "", aliases: "", definition: "", lang: "" };

/** `null` is closed, `"new"` creates, a term edits it. */
type Editing = null | "new" | GlossaryTerm;

function TermDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const { t } = useI18n();
  const term = editing === null || editing === "new" ? undefined : editing;
  const save = useSaveGlossaryTerm(term?.id);
  const form = useForm<GlossaryForm>({
    resolver: zodResolver(glossaryFormSchema),
    values: term ? toForm(term) : empty,
  });
  const e = form.formState.errors;
  /** Zod messages are i18n keys; server messages fall through translate unchanged. */
  const msg = (m?: string) => (m ? t(m as MessageKey) : undefined);
  const submit = form.handleSubmit((v) =>
    save.mutate(toPayload(v), {
      onSuccess: () => {
        notifySuccess(t("common.saved"));
        form.reset(empty);
        onClose();
      },
      onError: (er) => form.setError("term", { message: errorMessage(er) }),
    }),
  );
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(o) => {
        if (!o) {
          form.clearErrors();
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={t("common.close")} locked={save.isPending} aria-describedby={undefined}>
        <DialogTitle>{term ? t("glossary.edit") : t("glossary.new")}</DialogTitle>
        <form onSubmit={submit} noValidate className="grid gap-3">
          <Field label={t("glossary.term")} error={msg(e.term?.message)}>
            {(a) => <Input {...a} {...form.register("term")} autoFocus />}
          </Field>
          <Field label={t("glossary.aliases")} hint={t("glossary.aliasesHint")} error={msg(e.aliases?.message)}>
            {(a) => <Input {...a} {...form.register("aliases")} />}
          </Field>
          <Field label={t("glossary.definition")} error={msg(e.definition?.message)}>
            {(a) => <Textarea {...a} {...form.register("definition")} rows={4} />}
          </Field>
          <Field label={t("glossary.lang")} error={msg(e.lang?.message)}>
            {(a) => (
              <Select {...a} {...form.register("lang")}>
                {glossaryLangs.map((l) => (
                  <option key={l} value={l}>
                    {l === "" ? t("glossary.allLangs") : l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {term ? t("common.save") : t("common.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GlossaryPage() {
  const { t } = useI18n();
  const q = useGlossary();
  const del = useDeleteGlossaryTerm();
  const [editing, setEditing] = useState<Editing>(null);
  const [target, setTarget] = useState<GlossaryTerm | null>(null);
  return (
    <>
      <PageHeader
        title={t("glossary.title")}
        description={t("glossary.hint")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <PlusIcon aria-hidden />
            {t("glossary.new")}
          </Button>
        }
      />
      <TermDialog editing={editing} onClose={() => setEditing(null)} />
      <ListView query={q} items={q.data ?? []} empty={{ title: t("glossary.empty") }}>
        {(rows) => (
          <Table>
            <caption className="sr-only">{t("glossary.title")}</caption>
            <THead>
              <TR>
                <TH>{t("glossary.term")}</TH>
                <TH>{t("glossary.definition")}</TH>
                <TH>{t("glossary.lang")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((g) => (
                <TR key={g.id}>
                  <TD>
                    <span className="font-medium">{g.term}</span>
                    {g.aliases.length > 0 && (
                      <div className="text-xs text-muted-foreground">{g.aliases.join(", ")}</div>
                    )}
                  </TD>
                  <TD className="max-w-md text-sm text-muted-foreground">{g.definition}</TD>
                  <TD>
                    <Badge variant="secondary">{g.lang === "" ? t("glossary.allLangs") : g.lang}</Badge>
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t("common.edit")}: ${g.term}`}
                      onClick={() => setEditing(g)}
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t("common.delete")}: ${g.term}`}
                      onClick={() => setTarget(g)}
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
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t("glossary.deleteTitle")}
        description={`${target?.term ?? ""} — ${t("glossary.deleteBody")}`}
        confirmLabel={t("confirm.deleteTerm")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!target) return;
          await del.mutateAsync(target.id);
          notifySuccess(t("confirm.termDeleted", { name: target.term }));
        }}
      />
    </>
  );
}
