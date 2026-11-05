import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Can, permissionCode, type Role } from "@/contexts/identity";
import { errorMessage } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { notifyError, notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { ConfirmDialog, Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Checkbox, Input, Select } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { ErrorState, PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import {
  useCreateRole,
  useDeleteRole,
  useGrantPermission,
  usePermissionList,
  useRevokePermission,
  useRolePolicies,
  useRoles,
} from "../application/hooks";
import {
  describeConditions,
  grantablePermissions,
  policyRoles,
  type RoleInput,
  roleInputSchema,
} from "../domain/access";
import { RoleBadges } from "./PoliciesPage";

export function RolesPage() {
  const { t } = useI18n();
  const roles = useRoles();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title={t("roles.title")}
        actions={
          <Can code="role.write">
            <Button onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden />
              {t("roles.new")}
            </Button>
          </Can>
        }
      />
      <ListView query={roles} items={roles.data ?? []} empty={{ title: t("roles.empty") }}>
        {(rows) => (
          <Table>
            <caption className="sr-only">{t("roles.title")}</caption>
            <THead>
              <TR>
                <TH>{t("roles.name")}</TH>
                <TH>{t("roles.titleField")}</TH>
                <TH>{t("roles.permissions")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR
                  key={r.name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => void navigate({ to: "/roles/$name", params: { name: r.name } })}
                >
                  <TD>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/roles/$name"
                        params={{ name: r.name }}
                        className="font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <code>{r.name}</code>
                      </Link>
                      {r.is_system ? <Badge variant="outline">{t("roles.system")}</Badge> : null}
                    </div>
                  </TD>
                  <TD className="text-muted-foreground">{r.title || r.description || "—"}</TD>
                  <TD>
                    {r.wildcard ? (
                      <Badge variant="warning">{t("roles.allPermissions")}</Badge>
                    ) : (
                      <span className="tabular-nums">{r.permissions.length}</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <ChevronRightIcon className="inline size-4 text-muted-foreground" aria-hidden />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </ListView>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md" closeLabel={t("common.close")}>
          <DialogTitle>{t("roles.new")}</DialogTitle>
          <NewRole
            onCreated={(name) => {
              setCreating(false);
              void navigate({ to: "/roles/$name", params: { name } });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One role: its permissions, grant/revoke and delete. */
export function RoleDetailPage({ name }: { name: string }) {
  const { t } = useI18n();
  const roles = useRoles();
  const navigate = useNavigate();
  const [del, setDel] = useState(false);
  const remove = useDeleteRole();
  const role = roles.data?.find((r) => r.name === name);
  return (
    <>
      <Link to="/roles" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t("roles.title")}
      </Link>
      {roles.isPending ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : roles.isError ? (
        <ErrorState error={roles.error} />
      ) : !role ? (
        <ErrorState error={new Error(t("common.notFound"))} />
      ) : (
        <>
          <PageHeader title={role.name} description={role.title || undefined} />
          <div className="grid gap-6">
            <RoleCard role={role} onDelete={() => setDel(true)} />
            <Can code="policy.read">
              <RolePolicies role={role.name} />
            </Can>
          </div>
        </>
      )}
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={t("roles.deleteTitle", { name })}
        description={t("roles.deleteBody")}
        confirmLabel={t("confirm.deleteRole")}
        cancelLabel={t("common.cancel")}
        confirmText={name}
        onConfirm={async () => {
          await remove.mutateAsync(name);
          notifySuccess(t("confirm.roleDeleted", { name }));
          void navigate({ to: "/roles" });
        }}
      />
    </>
  );
}

function NewRole({ onCreated }: { onCreated: (name: string) => void }) {
  const { t } = useI18n();
  const create = useCreateRole();
  const form = useForm<RoleInput>({
    resolver: zodResolver(roleInputSchema),
    defaultValues: { name: "", title: "", description: "", wildcard: false },
  });
  const e = form.formState.errors;
  const submit = form.handleSubmit((v) =>
    create.mutate(v, {
      onSuccess: () => {
        notifySuccess(t("common.saved"));
        onCreated(v.name);
      },
      onError: (er) => form.setError("root", { message: errorMessage(er) }),
    }),
  );
  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <Field
        label={t("roles.name")}
        hint={t("roles.nameHint")}
        error={e.name?.message && t(e.name.message as MessageKey)}
      >
        {(a) => <Input {...a} autoCapitalize="none" {...form.register("name")} />}
      </Field>
      <Field label={t("roles.titleField")}>{(a) => <Input {...a} {...form.register("title")} />}</Field>
      <Field label={t("roles.description")}>{(a) => <Input {...a} {...form.register("description")} />}</Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox {...form.register("wildcard")} />
        {t("roles.wildcard")}
      </label>
      {e.root?.message ? (
        <p role="alert" className="text-sm text-destructive">
          {e.root.message}
        </p>
      ) : null}
      <Button type="submit" disabled={create.isPending}>
        <PlusIcon aria-hidden />
        {t("common.create")}
      </Button>
    </form>
  );
}

function RoleCard({ role, onDelete }: { role: Role; onDelete: () => void }) {
  const { t } = useI18n();
  const all = usePermissionList();
  const grant = useGrantPermission();
  const revoke = useRevokePermission();
  const [pick, setPick] = useState("");
  const perms = role.permissions;
  const options = all.data ? grantablePermissions(all.data, perms) : [];
  const selectId = `grant-${role.name}`;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <code>{role.name}</code>
            {role.title ? <span className="font-normal text-muted-foreground">{role.title}</span> : null}
            {role.is_system ? <Badge variant="outline">{t("roles.system")}</Badge> : null}
            {role.wildcard ? <Badge variant="warning">{t("roles.allPermissions")}</Badge> : null}
          </CardTitle>
          {role.description ? <CardDescription>{role.description}</CardDescription> : null}
        </div>
        {!role.is_system ? (
          <Can code="role.write">
            <Button variant="ghost" size="icon" aria-label={`${t("common.delete")}: ${role.name}`} onClick={onDelete}>
              <Trash2Icon className="text-destructive" aria-hidden />
            </Button>
          </Can>
        ) : null}
      </CardHeader>
      {!role.wildcard ? (
        <CardContent className="grid gap-3">
          <ul className="flex flex-wrap gap-1.5" aria-label={t("roles.permissions")}>
            {perms.map((p) => {
              const code = permissionCode(p);
              return (
                <li key={code}>
                  <Badge variant="secondary" className="gap-1 pr-1">
                    <code>{code}</code>
                    <Can code="role.write">
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
                        aria-label={`${t("roles.revoke")}: ${code}`}
                        disabled={revoke.isPending}
                        onClick={() =>
                          revoke.mutate(
                            { role: role.name, code },
                            {
                              onSuccess: () => notifySuccess(t("roles.revoked")),
                              onError: (e) => notifyError(e),
                            },
                          )
                        }
                      >
                        <XIcon className="size-3" aria-hidden />
                      </button>
                    </Can>
                  </Badge>
                </li>
              );
            })}
          </ul>
          <Can code="role.write">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pick)
                  grant.mutate(
                    { role: role.name, code: pick },
                    {
                      onSuccess: () => {
                        notifySuccess(t("roles.granted"));
                        setPick("");
                      },
                      onError: (er) => notifyError(er),
                    },
                  );
              }}
            >
              <label htmlFor={selectId} className="sr-only">
                {t("roles.pick")}
              </label>
              <Select id={selectId} value={pick} onChange={(e) => setPick(e.target.value)} className="max-w-xs">
                <option value="">{t("roles.pick")}</option>
                {options.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code}
                    {p.description ? ` — ${p.description}` : ""}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline" disabled={!pick || grant.isPending}>
                {t("roles.grant")}
              </Button>
            </form>
          </Can>
        </CardContent>
      ) : null}
    </Card>
  );
}

/** ABAC policies that apply to this role's holders. */
function RolePolicies({ role }: { role: string }) {
  const { t } = useI18n();
  const q = useRolePolicies(role);
  const rows = q.data ?? [];
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>{t("policies.title")}</CardTitle>
          <CardDescription>{t("policies.forRoleHint")}</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/policies">{t("policies.manage")}</Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <ListView bare query={q} items={rows} empty={{ title: t("policies.empty") }}>
          {(list) => (
            <Table>
              <THead>
                <TR>
                  <TH>{t("common.name")}</TH>
                  <TH>{t("policies.target")}</TH>
                  <TH>{t("policies.effect")}</TH>
                  <TH>{t("policies.roles")}</TH>
                  <TH>{t("policies.conditions")}</TH>
                </TR>
              </THead>
              <TBody>
                {list.map((p) => (
                  <TR key={p.id} className={p.enabled ? undefined : "opacity-60"}>
                    <TD className="font-medium">{p.name}</TD>
                    <TD>
                      <code>
                        {p.resource}.{p.action}
                      </code>
                    </TD>
                    <TD>
                      <Badge variant={p.effect === "deny" ? "destructive" : "success"}>
                        {t(`policies.${p.effect}`)}
                      </Badge>
                    </TD>
                    <TD>
                      <RoleBadges roles={policyRoles(p)} />
                    </TD>
                    <TD>
                      <code className="text-xs text-muted-foreground break-words">
                        {describeConditions(p) || t("policies.always")}
                      </code>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </ListView>
      </CardContent>
    </Card>
  );
}
