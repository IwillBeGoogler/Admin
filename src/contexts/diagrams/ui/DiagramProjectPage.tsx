import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { RelativeTime } from "@/shared/ui/relative-time";
import { ErrorState, LoadingRows, PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import { useDeleteProject, useDiagramProject, useRevokeShare } from "../application/hooks";
import { fileKinds, isShareActive, type Share } from "../domain/diagram";

export function DiagramProjectPage({ id }: { id: string }) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const manage = can("diagrams.manage");
  const navigate = useNavigate();
  const q = useDiagramProject(id);
  const del = useDeleteProject();
  const revoke = useRevokeShare(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revoking, setRevoking] = useState<Share | null>(null);
  const roleName = (r: string) => (isRole(r) ? t(`diagrams.roleName.${r}`) : r);

  if (q.isPending) return <LoadingRows rows={6} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p = q.data;
  return (
    <>
      <PageHeader
        title={p.name}
        description={
          <>
            {t("diagrams.owner")}: @{p.owner.username} · {t("diagrams.updated")} <RelativeTime value={p.updated_at} />
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/diagrams">
                <ArrowLeftIcon aria-hidden />
                {t("common.back")}
              </Link>
            </Button>
            {manage ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2Icon aria-hidden />
                {t("common.delete")}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("diagrams.files")}</CardTitle>
          </CardHeader>
          <CardContent>
            {p.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("diagrams.noFiles")}</p>
            ) : (
              <Table>
                <caption className="sr-only">{t("diagrams.files")}</caption>
                <THead>
                  <TR>
                    <TH>{t("common.name")}</TH>
                    <TH>{t("diagrams.type")}</TH>
                    <TH>{t("diagrams.version")}</TH>
                    <TH>{t("diagrams.updated")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {p.files.map((f) => (
                    <TR key={f.id}>
                      <TD className="font-medium">{f.name}</TD>
                      <TD>
                        <Badge variant="outline">{isKind(f.kind) ? t(`diagrams.kind.${f.kind}`) : f.kind}</Badge>
                      </TD>
                      <TD className="tabular-nums">v{f.version}</TD>
                      <TD>
                        <RelativeTime value={f.updated_at} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("diagrams.members")}</CardTitle>
          </CardHeader>
          <CardContent>
            {p.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("diagrams.noMembers")}</p>
            ) : (
              <Table>
                <caption className="sr-only">{t("diagrams.members")}</caption>
                <THead>
                  <TR>
                    <TH>{t("users.username")}</TH>
                    <TH>{t("diagrams.role")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {p.members.map((m) => (
                    <TR key={m.user_id}>
                      <TD className="font-medium">@{m.username}</TD>
                      <TD>{roleName(m.role)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("diagrams.shares")}</CardTitle>
          </CardHeader>
          <CardContent>
            {p.shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("diagrams.noShares")}</p>
            ) : (
              <Table>
                <caption className="sr-only">{t("diagrams.shares")}</caption>
                <THead>
                  <TR>
                    <TH>{t("diagrams.role")}</TH>
                    <TH>{t("diagrams.created")}</TH>
                    <TH>{t("diagrams.expires")}</TH>
                    <TH>{t("reports.status")}</TH>
                    <TH>
                      <span className="sr-only">{t("common.actions")}</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {p.shares.map((s) => {
                    const active = isShareActive(s);
                    return (
                      <TR key={s.id}>
                        <TD>{roleName(s.role)}</TD>
                        <TD>
                          <RelativeTime value={s.created_at} />
                        </TD>
                        <TD>{s.expires_at ? <RelativeTime value={s.expires_at} /> : t("diagrams.never")}</TD>
                        <TD>
                          <Badge variant={active ? "success" : "secondary"}>
                            {t(s.revoked_at ? "diagrams.revoked" : active ? "diagrams.active" : "diagrams.expired")}
                          </Badge>
                        </TD>
                        <TD className="text-right">
                          {manage && !s.revoked_at ? (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`${t("diagrams.revoke")}: ${roleName(s.role)} #${s.id}`}
                              onClick={() => setRevoking(s)}
                            >
                              {t("diagrams.revoke")}
                            </Button>
                          ) : null}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("diagrams.deleteTitle", { name: p.name })}
        description={t("diagrams.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          await del.mutateAsync(id);
          notifySuccess(t("common.deleted"));
          void navigate({ to: "/diagrams" });
        }}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("diagrams.revokeTitle")}
        description={t("diagrams.revokeBody")}
        confirmLabel={t("diagrams.revoke")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!revoking) return;
          await revoke.mutateAsync(revoking.id);
          notifySuccess(t("diagrams.revokedToast"));
        }}
      />
    </>
  );
}

const roles = ["owner", "editor", "commenter", "viewer"] as const;
const isRole = (r: string): r is (typeof roles)[number] => (roles as readonly string[]).includes(r);
const isKind = (k: string): k is (typeof fileKinds)[number] => (fileKinds as readonly string[]).includes(k);
