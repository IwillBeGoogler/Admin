import { BanIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { errorMessage } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, PendingLabel } from "@/shared/ui/dialog";
import { Field } from "@/shared/ui/field";
import { Textarea } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import { useCertificates, useRevokeCertificate } from "../application/hooks";
import { type Certificate, MAX_REVOKE_REASON } from "../domain/certificate";

function RevokeDialog({ certificate: c, onClose }: { certificate: Certificate; onClose: () => void }) {
  const { t } = useI18n();
  const revoke = useRevokeCertificate();
  const [reason, setReason] = useState("");
  const pending = revoke.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || pending) return;
    revoke.mutate(
      { id: c.id, reason: reason.trim() },
      {
        onSuccess: () => {
          notifySuccess(t("certificates.revokedDone", { id: c.id }));
          onClose();
        },
      },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent closeLabel={t("common.close")} locked={pending}>
        <DialogTitle>{t("certificates.revokeTitle")}</DialogTitle>
        <DialogDescription>
          {c.holder_name} — {c.title}. {t("certificates.revokeBody")}
        </DialogDescription>
        <form onSubmit={submit} noValidate className="grid gap-3">
          <Field label={t("certificates.reason")} error={revoke.error ? errorMessage(revoke.error) : undefined}>
            {(a) => (
              <Textarea
                {...a}
                value={reason}
                maxLength={MAX_REVOKE_REASON}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
              />
            )}
          </Field>
          <Button type="submit" variant="destructive" disabled={pending || !reason.trim()}>
            <PendingLabel pending={pending}>{t("certificates.revoke")}</PendingLabel>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CertificatesPage() {
  const { t } = useI18n();
  const q = useCertificates();
  const [target, setTarget] = useState<Certificate | null>(null);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeader title={t("certificates.title")} description={t("certificates.hint")} />
      <ListView query={q} items={items} empty={{ title: t("certificates.empty") }}>
        {(rows) => (
          <Table>
            <caption className="sr-only">{t("certificates.title")}</caption>
            <THead>
              <TR>
                <TH>{t("certificates.id")}</TH>
                <TH>{t("certificates.holder")}</TH>
                <TH>{t("certificates.challenge")}</TH>
                <TH>{t("certificates.result")}</TH>
                <TH>{t("certificates.issued")}</TH>
                <TH>{t("certificates.status")}</TH>
                <TH>
                  <span className="sr-only">{t("common.actions")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD className="font-mono text-xs">{c.id}</TD>
                  <TD>
                    <span className="font-medium">{c.holder_name}</span>
                    <div className="text-xs text-muted-foreground">@{c.username}</div>
                  </TD>
                  <TD className="max-w-md text-sm">{c.title}</TD>
                  <TD className="text-sm whitespace-nowrap tabular-nums">
                    {t("certificates.resultValue", { done: c.days_done, days: c.days, streak: c.best_streak })}
                  </TD>
                  <TD>
                    <RelativeTime value={c.issued_at} />
                  </TD>
                  <TD>
                    <Badge variant={c.revoked_at ? "warning" : "success"}>
                      {t(c.revoked_at ? "certificates.revoked" : "certificates.valid")}
                    </Badge>
                    {c.revoke_reason ? (
                      <div className="mt-1 max-w-xs text-xs break-words text-muted-foreground">{c.revoke_reason}</div>
                    ) : null}
                  </TD>
                  <TD className="text-right">
                    {c.revoked_at ? null : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("certificates.revoke")}: ${c.id}`}
                        onClick={() => setTarget(c)}
                      >
                        <BanIcon className="text-destructive" aria-hidden />
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </ListView>
      {target ? <RevokeDialog key={target.id} certificate={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}
