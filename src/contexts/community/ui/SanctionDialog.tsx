import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { isApiError } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/lib/format";
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
import { Input, Textarea } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { useBan, useLiftSanction, useSanction } from "../application/hooks";
import { type SanctionForm, sanctionFormSchema } from "../domain/sanction";

export function SanctionDialog({ username, onClose }: { username: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const current = useBan(username);
  const sanction = useSanction(username);
  const lift = useLiftSanction();
  const form = useForm<SanctionForm>({
    resolver: async (v, c, o) => zodResolver(sanctionFormSchema(new Date()))(v, c, o),
    defaultValues: { kind: "suspended", reason: "", until: "" },
  });
  const e = form.formState.errors;
  const msg = (m?: string) => (m ? t(m as MessageKey) : undefined);
  const kind = form.watch("kind");

  const [confirmBan, setConfirmBan] = useState<SanctionForm | null>(null);
  const pending = sanction.isPending || lift.isPending;

  /** Forms report validation inline only; server 5xx and network errors go to a toast. */
  const save = (v: SanctionForm) =>
    sanction.mutateAsync(v).then(
      () => {
        notifySuccess(t("users.sanctioned", { name: username }));
        onClose();
      },
      (err) => {
        if (isApiError(err) && err.status < 500) form.setError("root", { message: err.message });
        else notifyError(err);
      },
    );
  // A permanent ban is high-risk: confirm by typing the username first.
  const submit = form.handleSubmit((v) => (v.kind === "banned" ? setConfirmBan(v) : save(v)));

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent closeLabel={t("common.close")} locked={pending}>
        <DialogTitle>{t("users.banTitle", { name: username })}</DialogTitle>
        <DialogDescription>{t("users.replaceHint")}</DialogDescription>
        <section aria-label={t("users.current")} className="rounded-md border border-border p-3 text-sm">
          {current.isPending ? (
            <Skeleton className="h-5 w-48" />
          ) : current.data ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive">{t(`bans.k.${current.data.kind}`)}</Badge>
              <span>{current.data.reason}</span>
              <span className="text-muted-foreground">
                {current.data.until
                  ? `${t("bans.until")} ${formatDate(current.data.until, locale)}`
                  : t("bans.forever")}
              </span>
              <Button
                className="ml-auto"
                size="sm"
                variant="outline"
                disabled={pending}
                aria-busy={lift.isPending || undefined}
                onClick={() =>
                  lift.mutate(username, {
                    onSuccess: () => notifySuccess(t("users.lifted", { name: username })),
                    onError: (er) => notifyError(er),
                  })
                }
              >
                <PendingLabel pending={lift.isPending}>{t("users.unban")}</PendingLabel>
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground">{t("users.none")}</span>
          )}
        </section>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("users.kind")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="suspended" className="accent-primary" {...form.register("kind")} />
              {t("users.suspended")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="banned" className="accent-primary" {...form.register("kind")} />
              {t("users.banned")}
            </label>
          </fieldset>
          {kind === "suspended" ? (
            <Field label={t("users.until")} error={msg(e.until?.message)}>
              {(a) => <Input {...a} type="datetime-local" {...form.register("until")} />}
            </Field>
          ) : null}
          <Field label={t("users.reasonField")} error={msg(e.reason?.message)}>
            {(a) => <Textarea {...a} rows={3} maxLength={500} {...form.register("reason")} />}
          </Field>
          {e.root?.message ? (
            <p role="alert" className="text-sm text-destructive">
              {e.root.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending} aria-busy={sanction.isPending || undefined}>
              <PendingLabel pending={sanction.isPending}>{t("users.ban")}</PendingLabel>
            </Button>
          </DialogFooter>
        </form>
        <ConfirmDialog
          open={confirmBan !== null}
          onOpenChange={(o) => !o && setConfirmBan(null)}
          title={t("confirm.banPermanentTitle", { name: username })}
          description={t("confirm.banPermanentBody")}
          confirmLabel={t("confirm.banPermanent")}
          cancelLabel={t("common.cancel")}
          confirmText={username}
          onConfirm={() => (confirmBan ? save(confirmBan) : undefined)}
        />
      </DialogContent>
    </Dialog>
  );
}
