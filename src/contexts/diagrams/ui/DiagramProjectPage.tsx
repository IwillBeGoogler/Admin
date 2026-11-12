import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, ExternalLink, EyeIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { RelativeTime } from "@/shared/ui/relative-time";
import { ErrorState, LoadingRows, PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import { useDeleteProject, useDiagramProject, useFilePreview, useRevokeShare } from "../application/hooks";
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
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null);
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
      <PreviewDialog file={viewing} onClose={() => setViewing(null)} />
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
                    <TH>
                      <span className="sr-only">{t("diagrams.open")}</span>
                    </TH>
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
                      <TD className="space-x-2 text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => setViewing({ id: f.id, name: f.name })}>
                          <EyeIcon aria-hidden className="size-3.5" />
                          {t("diagrams.view")}
                        </Button>
                        <a
                          href={`${siteUrl()}/d/f/${encodeURIComponent(f.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                        >
                          {t("diagrams.open")}
                          <ExternalLink aria-hidden className="size-3.5" />
                        </a>
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

/** The public site's origin (the diagram editor lives there): VITE_SITE_URL, else derived from the admin's own address. */
function siteUrl(): string {
  const env = import.meta.env.VITE_SITE_URL as string | undefined;
  if (env) return env.replace(/\/$/, "");
  const { protocol, hostname, port } = window.location;
  const webPort = ({ "3100": "3000", "5174": "5173" } as Record<string, string>)[port] ?? port;
  return `${protocol}//${hostname.replace(/^admin\./, "")}${webPort ? `:${webPort}` : ""}`;
}

/** A file's pages rendered by the server as SVG, shown in place (read-only). An <img> keeps the markup inert. */
function PreviewDialog({ file, onClose }: { file: { id: string; name: string } | null; onClose: () => void }) {
  const { t } = useI18n();
  const q = useFilePreview(file?.id ?? null);
  return (
    <Dialog open={file !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[min(1100px,94vw)] max-w-none overflow-y-auto">
        <DialogTitle>{file?.name}</DialogTitle>
        <DialogDescription>{t("diagrams.previewHint")}</DialogDescription>
        {q.isPending ? (
          <LoadingRows rows={4} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("diagrams.noPages")}</p>
        ) : (
          <div className="grid gap-4">
            {q.data.pages.map((pg, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: pages have no id, repeat names, and the list is never reordered
              <figure key={`${i}-${pg.name}`} className="grid gap-2">
                {q.data.pages.length > 1 && (
                  <figcaption className="text-xs text-muted-foreground">{pg.name}</figcaption>
                )}
                <div className="overflow-auto rounded-lg border border-border bg-white p-2">
                  <img
                    alt={pg.name}
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pg.svg)}`}
                    className="mx-auto block h-auto max-w-full"
                  />
                </div>
              </figure>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
