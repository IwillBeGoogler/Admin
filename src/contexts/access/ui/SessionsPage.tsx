import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, CircleHelpIcon, MonitorIcon, SmartphoneIcon, TabletIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { Can } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { notifySuccess } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { ListView } from "@/shared/ui/list-view";
import { RelativeTime } from "@/shared/ui/relative-time";
import { ErrorState, PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import { useMySessions, useRevokeMySession, useRevokeUserSessions, useUserSessions } from "../application/hooks";
import { type DeviceKind, deviceKind, type Session, sessionStats } from "../domain/access";

const deviceIcon: Record<DeviceKind, typeof MonitorIcon> = {
  desktop: MonitorIcon,
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
  cli: TerminalIcon,
  unknown: CircleHelpIcon,
};

function SessionStatsBar({ sessions }: { sessions: Session[] }) {
  const { t } = useI18n();
  const st = sessionStats(sessions);
  const tiles: [string, number][] = [
    [t("sessions.statTotal"), st.total],
    [t("sessions.statActive"), st.active],
    [t("sessions.statIps"), st.uniqueIps],
    [t("sessions.statStarted24h"), st.started24h],
    [t("sessions.statExpiring"), st.expiringSoon],
  ];
  const hours = st.avgAgeMs / 3_600_000;
  const avgAge = hours >= 48 ? `${(hours / 24).toFixed(1)} d` : `${hours.toFixed(1)} h`;
  const groups: [string, [string, number][]][] = [
    [t("sessions.statDevices"), st.byDevice],
    [t("sessions.statBrowsers"), st.byBrowser],
    [t("sessions.statOs"), st.byOs],
  ];
  return (
    <div className="grid gap-3 px-6 pb-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="session-stats">
      {tiles.map(([label, n]) => (
        <div key={label} className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{n}</div>
        </div>
      ))}
      <div className="rounded-md border p-3">
        <div className="text-xs text-muted-foreground">{t("sessions.statAvgAge")}</div>
        <div className="text-2xl font-semibold">{st.total ? avgAge : "—"}</div>
      </div>
      {groups.map(([label, rows]) => (
        <div key={label} className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="flex flex-wrap gap-1 pt-1">
            {rows.map(([k, n]) => (
              <Badge key={k} variant="outline" className="capitalize">
                {k} · {n}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionTable({
  sessions,
  onRevoke,
  userId,
}: {
  sessions: Session[];
  onRevoke?: (s: Session) => void;
  /** Set for another user's sessions; the detail page looks them up there. */
  userId?: number;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const open = (s: Session) =>
    void navigate({ to: "/sessions/$id", params: { id: s.id }, search: userId ? { user: userId } : {} });
  return (
    <Table>
      <THead>
        <TR>
          <TH>{t("sessions.agent")}</TH>
          <TH>{t("sessions.ip")}</TH>
          <TH>{t("sessions.created")}</TH>
          <TH>{t("sessions.lastSeen")}</TH>
          <TH>{t("sessions.expires")}</TH>
          {onRevoke ? (
            <TH>
              <span className="sr-only">{t("common.actions")}</span>
            </TH>
          ) : null}
        </TR>
      </THead>
      <TBody>
        {sessions.map((s) => {
          const kind = deviceKind(s.user_agent);
          const DeviceIcon = deviceIcon[kind];
          return (
            <TR key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => open(s)}>
              <TD>
                <div className="flex max-w-xs items-center gap-2">
                  <DeviceIcon className="size-4 shrink-0 text-muted-foreground" data-device={kind} aria-hidden />
                  <Link
                    to="/sessions/$id"
                    params={{ id: s.id }}
                    search={userId ? { user: userId } : {}}
                    className="truncate hover:underline"
                    title={s.user_agent}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.user_agent || "—"}
                  </Link>
                  {s.current ? <Badge variant="success">{t("sessions.current")}</Badge> : null}
                </div>
              </TD>
              <TD>
                <code>{s.ip || "—"}</code>
              </TD>
              <TD>
                <RelativeTime value={s.created_at} />
              </TD>
              <TD>
                <RelativeTime value={s.last_seen_at} />
              </TD>
              <TD>
                <RelativeTime value={s.expires_at} />
              </TD>
              {onRevoke ? (
                <TD className="text-right">
                  {!s.current ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevoke(s);
                      }}
                    >
                      {t("sessions.revoke")}
                    </Button>
                  ) : null}
                </TD>
              ) : null}
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

export function SessionsPage() {
  const { t } = useI18n();
  const mine = useMySessions();
  const revoke = useRevokeMySession();
  const [userInput, setUserInput] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const theirs = useUserSessions(userId);
  const revokeAll = useRevokeUserSessions();
  const [confirm, setConfirm] = useState(false);
  const [revoking, setRevoking] = useState<Session | null>(null);
  return (
    <>
      <PageHeader title={t("sessions.title")} />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("sessions.mine")}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ListView bare query={mine} items={mine.data ?? []} empty={{ title: t("sessions.empty") }}>
              {(rows) => (
                <>
                  <SessionStatsBar sessions={rows} />
                  <SessionTable sessions={rows} onRevoke={setRevoking} />
                </>
              )}
            </ListView>
          </CardContent>
        </Card>
        <Can code="session.read">
          <Card>
            <CardHeader>
              <CardTitle>{t("sessions.ofUser")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(userInput);
                  if (Number.isInteger(n) && n > 0) setUserId(n);
                }}
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="sess-user">{t("sessions.userId")}</Label>
                  <Input
                    id="sess-user"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-40"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="outline">
                  {t("sessions.lookup")}
                </Button>
                {userId !== null && theirs.data?.length ? (
                  <Can code="session.revoke">
                    <Button variant="destructive" onClick={() => setConfirm(true)}>
                      {t("sessions.revokeAll")}
                    </Button>
                  </Can>
                ) : null}
              </form>
              {userId === null ? null : (
                <ListView bare query={theirs} items={theirs.data ?? []} empty={{ title: t("sessions.empty") }}>
                  {(rows) => (
                    <>
                      <SessionStatsBar sessions={rows} />
                      <SessionTable sessions={rows} userId={userId} />
                    </>
                  )}
                </ListView>
              )}
            </CardContent>
          </Card>
        </Can>
      </div>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t("confirm.revokeSessionTitle")}
        description={
          revoking ? `${revoking.user_agent || "—"} · ${revoking.ip || "—"} — ${t("confirm.revokeSessionBody")}` : ""
        }
        confirmLabel={t("confirm.revokeSession")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!revoking) return;
          await revoke.mutateAsync(revoking.id);
          notifySuccess(t("sessions.revoked"));
        }}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("sessions.revokeAllTitle", { id: userId ?? 0 })}
        description={t("sessions.revokeAllBody")}
        confirmLabel={t("confirm.revokeAllSessions")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (userId === null) return;
          await revokeAll.mutateAsync(userId);
          notifySuccess(t("sessions.revokedAll"));
        }}
      />
    </>
  );
}

/** One session: device, network and timing, with revoke. */
export function SessionDetailPage({ id, userId }: { id: string; userId?: number | undefined }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const mine = useMySessions(!userId);
  const theirs = useUserSessions(userId ?? null);
  const q = userId ? theirs : mine;
  const revoke = useRevokeMySession();
  const [confirm, setConfirm] = useState(false);
  const s = q.data?.find((x) => x.id === id);
  const kind = s ? deviceKind(s.user_agent) : "unknown";
  const DeviceIcon = deviceIcon[kind];
  const rows: [string, React.ReactNode][] = s
    ? [
        [
          t("sessions.device"),
          <span key="d" className="capitalize">
            {kind}
          </span>,
        ],
        [
          t("sessions.agent"),
          <span key="a" className="break-all">
            {s.user_agent || "—"}
          </span>,
        ],
        [t("sessions.ip"), <code key="i">{s.ip || "—"}</code>],
        [t("sessions.created"), <RelativeTime key="c" value={s.created_at} />],
        [t("sessions.lastSeen"), <RelativeTime key="l" value={s.last_seen_at} />],
        [t("sessions.expires"), <RelativeTime key="e" value={s.expires_at} />],
        [
          "ID",
          <code key="id" className="break-all text-xs">
            {s.id}
          </code>,
        ],
      ]
    : [];
  return (
    <>
      <Link
        to="/sessions"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t("sessions.title")}
      </Link>
      {q.isPending ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : !s ? (
        <ErrorState error={new Error(t("common.notFound"))} />
      ) : (
        <>
          <PageHeader
            title={userId ? t("sessions.ofUserTitle", { id: userId }) : t("sessions.mine")}
            actions={
              !userId && !s.current ? (
                <Button variant="destructive" onClick={() => setConfirm(true)}>
                  {t("sessions.revoke")}
                </Button>
              ) : null
            }
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DeviceIcon className="size-5 text-muted-foreground" data-device={kind} aria-hidden />
                {s.ip || "—"}
                {s.current ? <Badge variant="success">{t("sessions.current")}</Badge> : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("confirm.revokeSessionTitle")}
        description={t("confirm.revokeSessionBody")}
        confirmLabel={t("confirm.revokeSession")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          await revoke.mutateAsync(id);
          notifySuccess(t("sessions.revoked"));
          void navigate({ to: "/sessions" });
        }}
      />
    </>
  );
}
