import { BookOpenTextIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { usePermissions } from "@/contexts/identity";
import { errorMessage } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Input, Select, Textarea } from "@/shared/ui/input";
import { useSaveGlossaryTerm } from "../application/hooks";
import { type ArticleTermForm, articleTermIssue, glossaryLangs, parseAliases } from "../domain/glossary";

type Scope = "article" | "all";
/** `null` closed; `index: -1` adds, otherwise edits that entry. */
type Draft = null | { index: number; term: ArticleTermForm };

const blank: ArticleTermForm = { term: "", aliases: "", definition: "" };

/** "Add to glossary" button, the article's own terms and the dialog to create or edit one. */
export function ArticleGlossary({
  terms,
  onChange,
  getSelection,
}: {
  terms: ArticleTermForm[];
  onChange: (next: ArticleTermForm[]) => void;
  getSelection: () => string;
}) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const canGlobal = can("glossary.write");
  const saveGlobal = useSaveGlossaryTerm(undefined);
  const [draft, setDraft] = useState<Draft>(null);
  const [scope, setScope] = useState<Scope>("article");
  const [lang, setLang] = useState("");
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setDraft(null);
    setError(undefined);
  };
  const open = (index: number, term: ArticleTermForm) => {
    setScope("article");
    setLang("");
    setError(undefined);
    setDraft({ index, term });
  };
  const patch = (p: Partial<ArticleTermForm>) => setDraft((d) => (d ? { ...d, term: { ...d.term, ...p } } : d));

  const submit = (ev: FormEvent) => {
    // The dialog is portalled but React still bubbles its submit to the post form.
    ev.preventDefault();
    ev.stopPropagation();
    if (!draft) return;
    const entry = draft.term;
    const global = draft.index < 0 && scope === "all";
    const others = global ? [] : terms.filter((_, i) => i !== draft.index);
    const issue = articleTermIssue(entry, others);
    if (issue) return setError(t(issue as MessageKey));
    const clean = {
      term: entry.term.trim(),
      aliases: parseAliases(entry.aliases).join(", "),
      definition: entry.definition.trim(),
    };
    if (global) {
      saveGlobal.mutate(
        { term: clean.term, aliases: parseAliases(clean.aliases), definition: clean.definition, lang },
        {
          onSuccess: () => {
            notifySuccess(t("glossary.addedGlobal"));
            close();
          },
          onError: (er) => setError(errorMessage(er)),
        },
      );
      return;
    }
    onChange(draft.index < 0 ? [...terms, clean] : terms.map((x, i) => (i === draft.index ? clean : x)));
    if (draft.index < 0) notifySuccess(t("glossary.addedArticle"));
    close();
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => open(-1, { ...blank, term: getSelection().trim() })}
        >
          <BookOpenTextIcon aria-hidden />
          {t("glossary.addToGlossary")}
        </Button>
      </div>
      <section aria-label={t("glossary.articleTerms")} className="grid gap-1">
        <h3 className="text-sm font-medium">{t("glossary.articleTerms")}</h3>
        {terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("glossary.noArticleTerms")}</p>
        ) : (
          <ul className="grid gap-1">
            {terms.map((g, i) => (
              <li
                key={g.term}
                className="flex items-start justify-between gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{g.term}</span>
                  {g.aliases ? <span className="text-xs text-muted-foreground"> ({g.aliases})</span> : null}
                  <p className="truncate text-xs text-muted-foreground">{g.definition}</p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("common.edit")}: ${g.term}`}
                    onClick={() => open(i, g)}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("common.delete")}: ${g.term}`}
                    onClick={() => onChange(terms.filter((_, k) => k !== i))}
                  >
                    <Trash2Icon className="text-destructive" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Dialog open={draft !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent closeLabel={t("common.close")} locked={saveGlobal.isPending} aria-describedby={undefined}>
          <DialogTitle>{draft && draft.index >= 0 ? t("glossary.edit") : t("glossary.addToGlossary")}</DialogTitle>
          <form onSubmit={submit} noValidate className="grid gap-3">
            <Field label={t("glossary.term")} error={error}>
              {(a) => (
                <Input
                  {...a}
                  value={draft?.term.term ?? ""}
                  onChange={(e) => patch({ term: e.target.value })}
                  autoFocus
                />
              )}
            </Field>
            <Field label={t("glossary.aliases")} hint={t("glossary.aliasesHint")}>
              {(a) => (
                <Input {...a} value={draft?.term.aliases ?? ""} onChange={(e) => patch({ aliases: e.target.value })} />
              )}
            </Field>
            <Field label={t("glossary.definition")}>
              {(a) => (
                <Textarea
                  {...a}
                  rows={4}
                  value={draft?.term.definition ?? ""}
                  onChange={(e) => patch({ definition: e.target.value })}
                />
              )}
            </Field>
            {canGlobal && draft && draft.index < 0 ? (
              <>
                <Field label={t("glossary.scope")}>
                  {(a) => (
                    <Select {...a} value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
                      <option value="article">{t("glossary.scopeArticle")}</option>
                      <option value="all">{t("glossary.scopeAll")}</option>
                    </Select>
                  )}
                </Field>
                {scope === "all" ? (
                  <Field label={t("glossary.lang")}>
                    {(a) => (
                      <Select {...a} value={lang} onChange={(e) => setLang(e.target.value)}>
                        {glossaryLangs.map((l) => (
                          <option key={l} value={l}>
                            {l === "" ? t("glossary.allLangs") : l}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ) : null}
              </>
            ) : null}
            <Button type="submit" disabled={saveGlobal.isPending}>
              {draft && draft.index >= 0 ? t("common.save") : t("common.create")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
