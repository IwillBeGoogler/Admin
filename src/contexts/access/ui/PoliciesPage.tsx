import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Can, usePermissions } from "@/contexts/identity";
import { errorMessage } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { notifyError, notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle, PendingLabel } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Checkbox, Input, Select } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import { useDeletePolicy, usePolicies, useRoles, useSavePolicy } from "../application/hooks";
import {
  describeConditions,
  inputToPolicy,
  isManaged,
  nestedGroups,
  type Policy,
  type PolicyInput,
  policyInputSchema,
  policyOperators,
  policyRoles,
  policyTemplates,
  policyToInput,
} from "../domain/access";

/** Attributes Guard resolves in conditions; free text is allowed too. */
const knownFields = [
  "user.id",
  "user.roles",
  "user.status",
  "resource.id",
  "resource.type",
  "resource.owner_id",
  "env.ip",
  "env.time",
  "env.weekday",
  "env.date",
  "env.method",
  "env.origin",
];

export function PoliciesPage() {
  const { t } = useI18n();
  const q = usePolicies();
  const save = useSavePolicy();
  const [editing, setEditing] = useState<Policy | "new" | null>(null);
  const [del, setDel] = useState<Policy | null>(null);
  const remove = useDeletePolicy();
  const canWrite = usePermissions().can("policy.write");

  const toggle = (p: Policy) => {
    const { id, ...body } = p;
    save.mutate(
      { id, body: { ...body, enabled: !p.enabled } },
      { onSuccess: () => notifySuccess(t("common.saved")), onError: (e) => notifyError(e) },
    );
  };

  return (
    <>
      <PageHeader
        title={t("policies.title")}
        description={t("policies.intro")}
        actions={
          <Can code="policy.write">
            <Button onClick={() => setEditing("new")}>
              <PlusIcon aria-hidden />
              {t("policies.new")}
            </Button>
          </Can>
        }
      />
      <ListView query={q} items={q.data ?? []} empty={{ title: t("policies.empty") }}>
        {(rows) => (
          <Table>
            <caption className="sr-only">{t("policies.title")}</caption>
            <THead>
              <TR>
                <TH>{t("policies.priority")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("policies.target")}</TH>
                <TH>{t("policies.effect")}</TH>
                <TH>{t("policies.roles")}</TH>
                <TH>{t("policies.conditions")}</TH>
                <TH>{t("policies.enabled")}</TH>
                {canWrite ? <TH className="sr-only">{t("common.actions")}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id} className={p.enabled ? undefined : "opacity-60"}>
                  <TD className="tabular-nums">{p.priority}</TD>
                  <TD className="font-medium">
                    {isManaged(p) ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {p.name.slice("config: ".length)}
                        <Badge variant="outline" title={t("policies.managedHint")}>
                          {t("policies.managed")}
                        </Badge>
                      </span>
                    ) : (
                      p.name
                    )}
                  </TD>
                  <TD>
                    <code>
                      {p.resource}.{p.action}
                    </code>
                  </TD>
                  <TD>
                    <Badge variant={p.effect === "deny" ? "destructive" : "success"}>{t(`policies.${p.effect}`)}</Badge>
                  </TD>
                  <TD>
                    <RoleBadges roles={policyRoles(p)} />
                  </TD>
                  <TD className="max-w-md">
                    <code className="text-xs text-muted-foreground break-words">
                      {describeConditions(p) || t("policies.always")}
                    </code>
                  </TD>
                  <TD>
                    <Checkbox
                      aria-label={`${t("policies.enabled")}: ${p.name}`}
                      checked={p.enabled}
                      disabled={!canWrite || isManaged(p) || save.isPending}
                      onChange={() => toggle(p)}
                    />
                  </TD>
                  {canWrite ? (
                    <TD className="whitespace-nowrap text-right">
                      {isManaged(p) ? null : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t("common.edit")}: ${p.name}`}
                            onClick={() => setEditing(p)}
                          >
                            <PencilIcon aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${t("common.delete")}: ${p.name}`}
                            onClick={() => setDel(p)}
                          >
                            <Trash2Icon className="text-destructive" aria-hidden />
                          </Button>
                        </>
                      )}
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </ListView>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null ? (
          <PolicyForm
            key={editing === "new" ? "new" : editing.id}
            policy={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={t("policies.deleteTitle", { name: del?.name ?? "" })}
        description={t("policies.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!del) return;
          await remove.mutateAsync(del.id);
          notifySuccess(t("policies.deleted", { name: del.name }));
        }}
      />
    </>
  );
}

function PolicyForm({ policy, onDone }: { policy: Policy | null; onDone: () => void }) {
  const { t } = useI18n();
  const save = useSavePolicy();
  const form = useForm<PolicyInput>({
    resolver: zodResolver(policyInputSchema),
    defaultValues: policyToInput(policy),
  });
  const conds = useFieldArray({ control: form.control, name: "conditions" });
  const e = form.formState.errors;
  const msg = (m?: string) => (m ? t(m as MessageKey) : undefined);
  const nested = nestedGroups(policy);
  const roles = useRoles();
  const picked = form.watch("roles");
  const togglePick = (name: string) =>
    form.setValue("roles", picked.includes(name) ? picked.filter((r) => r !== name) : [...picked, name], {
      shouldDirty: true,
    });

  const submit = form.handleSubmit((v) =>
    save.mutate(
      { id: policy?.id ?? null, body: inputToPolicy(v, nested) },
      {
        onSuccess: () => {
          notifySuccess(t("common.saved"));
          onDone();
        },
        onError: (er) => form.setError("root", { message: errorMessage(er) }),
      },
    ),
  );

  return (
    <DialogContent className="max-w-2xl" closeLabel={t("common.close")} locked={save.isPending}>
      <DialogTitle>{policy ? t("policies.edit") : t("policies.new")}</DialogTitle>
      <DialogDescription>{t("policies.formHint")}</DialogDescription>
      {policy ? null : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("policies.templates")}</span>
          {(Object.keys(policyTemplates) as (keyof typeof policyTemplates)[]).map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => form.reset({ ...form.getValues(), ...policyTemplates[k]() })}
            >
              {t(`policies.template.${k}`)}
            </Button>
          ))}
        </div>
      )}
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Field label={t("common.name")} error={msg(e.name?.message)}>
          {(a) => <Input {...a} {...form.register("name")} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("policies.resource")} hint={t("policies.targetHint")} error={msg(e.resource?.message)}>
            {(a) => <Input {...a} autoCapitalize="none" placeholder="post" {...form.register("resource")} />}
          </Field>
          <Field label={t("policies.action")} hint={t("policies.targetHint")} error={msg(e.action?.message)}>
            {(a) => <Input {...a} autoCapitalize="none" placeholder="update" {...form.register("action")} />}
          </Field>
          <Field label={t("policies.effect")}>
            {(a) => (
              <Select {...a} {...form.register("effect")}>
                <option value="allow">{t("policies.allow")}</option>
                <option value="deny">{t("policies.deny")}</option>
              </Select>
            )}
          </Field>
          <Field label={t("policies.priority")} hint={t("policies.priorityHint")} error={msg(e.priority?.message)}>
            {(a) => <Input {...a} type="number" step={1} {...form.register("priority", { valueAsNumber: true })} />}
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox {...form.register("enabled")} />
          {t("policies.enabled")}
        </label>

        <fieldset className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">{t("policies.roles")}</legend>
          <p className="text-xs text-muted-foreground">{t("policies.rolesHint")}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(roles.data ?? []).map((r) => (
              <label key={r.name} className="flex items-center gap-2 text-sm">
                <Checkbox checked={picked.includes(r.name)} onChange={() => togglePick(r.name)} />
                <code>{r.name}</code>
              </label>
            ))}
            {/* roles the policy names that no longer exist */}
            {picked
              .filter((n) => roles.data && !roles.data.some((r) => r.name === n))
              .map((n) => (
                <label key={n} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                  <Checkbox checked onChange={() => togglePick(n)} />
                  <code>{n}</code>
                </label>
              ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">{t("policies.conditions")}</legend>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              {t("policies.match")}
              <Select className="w-auto" {...form.register("match")}>
                <option value="and">{t("policies.matchAll")}</option>
                <option value="or">{t("policies.matchAny")}</option>
              </Select>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox {...form.register("negate")} />
              {t("policies.negate")}
            </label>
          </div>
          <datalist id="policy-fields">
            {knownFields.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          {conds.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("policies.noConditions")}</p>
          ) : null}
          {conds.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-start">
              <Input
                aria-label={`${t("policies.field")} ${i + 1}`}
                aria-invalid={!!e.conditions?.[i]?.field}
                list="policy-fields"
                autoCapitalize="none"
                placeholder="resource.owner_id"
                {...form.register(`conditions.${i}.field`)}
              />
              <Select aria-label={`${t("policies.operator")} ${i + 1}`} {...form.register(`conditions.${i}.operator`)}>
                {policyOperators.map((o) => (
                  <option key={o} value={o}>
                    {t(`policies.op.${o}`)}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`${t("policies.value")} ${i + 1}`}
                autoCapitalize="none"
                placeholder="$user.id"
                {...form.register(`conditions.${i}.value`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${t("policies.removeCondition")} ${i + 1}`}
                onClick={() => conds.remove(i)}
              >
                <XIcon aria-hidden />
              </Button>
              {e.conditions?.[i]?.field?.message ? (
                <p role="alert" className="text-xs text-destructive sm:col-span-4">
                  {msg(e.conditions[i].field.message)}
                </p>
              ) : null}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("policies.valueHint")}</p>
          {nested.length ? (
            <p className="text-xs text-muted-foreground">{t("policies.nestedKept", { n: nested.length })}</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={() => conds.append({ field: "", operator: "eq", value: "" })}
          >
            <PlusIcon aria-hidden />
            {t("policies.addCondition")}
          </Button>
        </fieldset>

        {e.root?.message ? (
          <p role="alert" className="text-sm text-destructive">
            {e.root.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            <PendingLabel pending={save.isPending}>{policy ? t("common.save") : t("common.create")}</PendingLabel>
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

export function RoleBadges({ roles }: { roles: string[] }) {
  const { t } = useI18n();
  if (!roles.length) return <span className="text-sm text-muted-foreground">{t("policies.everyone")}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} variant="outline">
          <code>{r}</code>
        </Badge>
      ))}
    </span>
  );
}
