import { DownloadIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense } from "react";
import { useAudit } from "@/contexts/access";
import { usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { downloadText, toCsv } from "@/shared/lib/csv";
import { formatNumber } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/shared/ui/states";
import { useInsights } from "../application/queries";
import {
  activityFromAudit,
  INSIGHT_DAYS,
  INSIGHT_TABS,
  type InsightNamed,
  type Insights,
  type InsightsSearch,
  type InsightTab,
  mergeDays,
  type SeriesRow,
} from "../domain/insights";

const SeriesChart = lazy(() => import("./Charts").then((m) => ({ default: m.SeriesChart })));
const CategoryChart = lazy(() => import("./Charts").then((m) => ({ default: m.CategoryChart })));

type Fmt = (n: number) => string;

function Kpi({ label, value }: { label: string; value: string | undefined }) {
  return (
    <Card>
      <CardContent className="grid gap-1 pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Series({ title, rows, series }: { title: string; rows: SeriesRow[]; series: Record<string, string> }) {
  const { t } = useI18n();
  return (
    <Panel title={title}>
      <div className="h-64">
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <SeriesChart data={rows} series={series} />
        </Suspense>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{t("insights.day")}</th>
            {Object.values(series).map((l) => (
              <th key={l} scope="col">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <th scope="row">{r.day}</th>
              {Object.keys(series).map((k) => (
                <td key={k}>{r[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Breakdown({ title, rows, label }: { title: string; rows: InsightNamed[]; label?: (key: string) => string }) {
  const { t } = useI18n();
  const data = rows
    .filter((r) => r.count > 0)
    .map((r) => ({ name: label ? label(r.key) : r.key || t("insights.none"), count: r.count }));
  return (
    <Panel title={title}>
      {data.length === 0 ? (
        <div className="h-64">
          <EmptyState title={t("insights.empty")} />
        </div>
      ) : (
        <>
          <div style={{ height: Math.max(160, data.length * 32 + 16) }}>
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <CategoryChart data={data} />
            </Suspense>
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {data.map((d) => (
                <tr key={d.name}>
                  <th scope="row">{d.name}</th>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}

function TopList({ title, rows, n }: { title: string; rows: { key: string; hint?: string; value: number }[]; n: Fmt }) {
  const { t } = useI18n();
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("insights.empty")}</p>
      ) : (
        <ol className="grid gap-1 text-sm">
          {rows.map((r) => (
            <li key={r.key + (r.hint ?? "")} className="flex justify-between gap-3">
              <span className="truncate">
                {r.key} {r.hint ? <span className="text-muted-foreground">{r.hint}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{n(r.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

const grid4 = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";
const grid2 = "grid gap-6 lg:grid-cols-2";

function PostsTab({ d, n }: { d: Insights; n: Fmt }) {
  const { t } = useI18n();
  const p = d.posts;
  const post = (x: Insights["posts"]["top_liked"][number], v: number) => ({
    key: x.title,
    hint: `@${x.author}`,
    value: v,
  });
  return (
    <>
      <div className={grid4}>
        <Kpi label={t("insights.posts.total")} value={n(p.total)} />
        <Kpi label={t("insights.posts.published")} value={n(p.published)} />
        <Kpi label={t("insights.posts.drafts")} value={n(p.drafts)} />
        <Kpi label={t("insights.posts.likes")} value={n(p.likes)} />
      </div>
      <Series
        title={t("insights.posts.perDay")}
        rows={mergeDays({ created: p.created, published: p.published_per_day, comments: p.comments_per_day })}
        series={{
          created: t("insights.posts.created"),
          published: t("insights.posts.publishedLabel"),
          comments: t("insights.posts.commentsLabel"),
        }}
      />
      <div className={grid2}>
        <Breakdown title={t("insights.posts.byCategory")} rows={p.by_category} />
        <TopList title={t("insights.posts.topLiked")} rows={p.top_liked.map((x) => post(x, x.likes))} n={n} />
        <TopList
          title={t("insights.posts.topCommented")}
          rows={p.top_commented.map((x) => post(x, x.comments))}
          n={n}
        />
      </div>
    </>
  );
}

function UsersTab({ d, n }: { d: Insights; n: Fmt }) {
  const { t } = useI18n();
  const u = d.users;
  return (
    <>
      <div className={grid4}>
        <Kpi label={t("insights.users.total")} value={n(u.total)} />
        <Kpi label={t("insights.users.new")} value={n(u.new)} />
        <Kpi label={t("insights.users.verified")} value={n(u.verified)} />
        <Kpi label={t("insights.users.sanctioned")} value={n(u.sanctioned)} />
      </div>
      <Series
        title={t("insights.users.signups")}
        rows={mergeDays({ signups: u.signups })}
        series={{ signups: t("insights.users.signupsLabel") }}
      />
      <TopList
        title={t("insights.users.topAuthors")}
        rows={u.top_authors.map((a) => ({ key: `@${a.key}`, value: a.count }))}
        n={n}
      />
    </>
  );
}

function DiagramsTab({ d, n }: { d: Insights; n: Fmt }) {
  const { t } = useI18n();
  const g = d.diagrams;
  return (
    <>
      <div className={grid4}>
        <Kpi label={t("insights.diagrams.projects")} value={n(g.projects)} />
        <Kpi label={t("insights.diagrams.files")} value={n(g.files)} />
        <Kpi label={t("insights.diagrams.public")} value={n(g.public)} />
        <Kpi label={t("insights.diagrams.templates")} value={n(g.templates)} />
      </div>
      <Series
        title={t("insights.diagrams.created")}
        rows={mergeDays({ created: g.created })}
        series={{ created: t("insights.diagrams.createdLabel") }}
      />
      <div className={grid2}>
        <Breakdown title={t("insights.diagrams.byKind")} rows={g.by_kind} />
        <Breakdown title={t("insights.diagrams.byVisibility")} rows={g.by_visibility} />
        <TopList
          title={t("insights.diagrams.topOwners")}
          rows={g.top_owners.map((a) => ({ key: `@${a.key}`, value: a.count }))}
          n={n}
        />
      </div>
    </>
  );
}

function ModerationTab({ d, n }: { d: Insights; n: Fmt }) {
  const { t } = useI18n();
  const m = d.moderation;
  return (
    <>
      <div className={grid4}>
        <Kpi label={t("insights.moderation.openReports")} value={n(m.open_reports)} />
        <Kpi label={t("insights.moderation.openFeedback")} value={n(m.open_feedback)} />
        <Kpi label={t("insights.moderation.openErrors")} value={n(m.open_errors)} />
        <Kpi
          label={t("insights.moderation.avgResolve")}
          value={t("insights.hours", { n: Math.round(m.avg_resolve_hours * 10) / 10 })}
        />
      </div>
      <Series
        title={t("insights.moderation.perDay")}
        rows={mergeDays({ opened: m.opened, resolved: m.resolved })}
        series={{ opened: t("insights.moderation.opened"), resolved: t("insights.moderation.resolved") }}
      />
      <div className={grid2}>
        <Breakdown title={t("insights.moderation.byReason")} rows={m.by_reason} />
        <Breakdown title={t("insights.moderation.feedbackByKind")} rows={m.feedback_by_kind} />
      </div>
    </>
  );
}

function ActivityTab({ days, n }: { days: number; n: Fmt }) {
  const { t } = useI18n();
  const log = useAudit({ limit: 500 });
  if (log.isError) return <ErrorState error={log.error} onRetry={() => void log.refetch()} />;
  const a = log.data ? activityFromAudit(log.data, days) : undefined;
  return (
    <>
      <div className={grid4}>
        <Kpi label={t("insights.activity.events")} value={a ? n(a.total) : undefined} />
        <Kpi label={t("insights.activity.failed")} value={a ? n(a.failed) : undefined} />
        <Kpi label={t("insights.activity.logins")} value={a ? n(a.logins) : undefined} />
      </div>
      {a ? (
        <>
          <Series
            title={t("insights.activity.perDay")}
            rows={a.perDay.map((r) => ({ day: r.day, ok: r.ok, failed: r.failed }))}
            series={{ ok: t("insights.activity.ok"), failed: t("insights.activity.failedLabel") }}
          />
          <div className={grid2}>
            <Breakdown title={t("insights.activity.byAction")} rows={a.actions} />
            <TopList
              title={t("insights.activity.topActors")}
              rows={a.actors.map((x) => ({ key: x.key, value: x.count }))}
              n={n}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("insights.activity.note")}</p>
        </>
      ) : (
        <Skeleton className="h-64 w-full" />
      )}
    </>
  );
}

/** Flat rows of the current tab for CSV export: section, label, value. */
const csvRows = (tab: InsightTab, d: Insights): [string, string, number][] => {
  const days = (s: string, v: { day: string; count: number }[]): [string, string, number][] =>
    v.map((x) => [s, x.day, x.count]);
  const named = (s: string, v: InsightNamed[]): [string, string, number][] => v.map((x) => [s, x.key, x.count]);
  switch (tab) {
    case "posts":
      return [
        ...days("created", d.posts.created),
        ...days("published", d.posts.published_per_day),
        ...days("comments", d.posts.comments_per_day),
        ...named("category", d.posts.by_category),
        ...d.posts.top_liked.map((p): [string, string, number] => ["top_liked", p.title, p.likes]),
        ...d.posts.top_commented.map((p): [string, string, number] => ["top_commented", p.title, p.comments]),
      ];
    case "users":
      return [...days("signups", d.users.signups), ...named("top_authors", d.users.top_authors)];
    case "diagrams":
      return [
        ...days("created", d.diagrams.created),
        ...named("kind", d.diagrams.by_kind),
        ...named("visibility", d.diagrams.by_visibility),
        ...named("top_owners", d.diagrams.top_owners),
      ];
    case "moderation":
      return [
        ...days("opened", d.moderation.opened),
        ...days("resolved", d.moderation.resolved),
        ...named("reason", d.moderation.by_reason),
        ...named("feedback_kind", d.moderation.feedback_by_kind),
      ];
    default:
      return [];
  }
};

export function InsightsPage({
  search,
  onSearchChange,
}: {
  search: InsightsSearch;
  onSearchChange: (s: InsightsSearch) => void;
}) {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const q = useInsights(search.days);
  const n: Fmt = (v) => formatNumber(v, locale);
  const tabs = INSIGHT_TABS.filter((x) => x !== "activity" || can("audit.read"));
  const tab = tabs.includes(search.tab) ? search.tab : "posts";
  const d = q.data;
  const exportable = tab !== "activity" && d && csvRows(tab, d).length > 0;

  const exportCsv = () => {
    if (!d) return;
    downloadText(`insights-${tab}-${search.days}d.csv`, toCsv(["section", "label", "value"], csvRows(tab, d)));
  };

  return (
    <>
      <PageHeader
        title={t("insights.title")}
        description={t("insights.note")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <fieldset className="m-0 flex gap-1 border-0 p-0">
              <legend className="sr-only">{t("insights.period")}</legend>
              {INSIGHT_DAYS.map((x) => (
                <Button
                  key={x}
                  size="sm"
                  variant={search.days === x ? "default" : "outline"}
                  aria-pressed={search.days === x}
                  onClick={() => onSearchChange({ ...search, days: x })}
                >
                  {t("product.days", { n: x })}
                </Button>
              ))}
            </fieldset>
            <Button size="sm" variant="outline" disabled={!exportable} onClick={exportCsv}>
              <DownloadIcon aria-hidden /> {t("insights.export")}
            </Button>
          </div>
        }
      />
      <div role="tablist" aria-label={t("insights.title")} className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            id={`insights-tab-${x}`}
            aria-selected={tab === x}
            aria-controls="insights-panel"
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === x
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onSearchChange({ ...search, tab: x })}
          >
            {t(`insights.tabs.${x}`)}
          </button>
        ))}
      </div>
      <div id="insights-panel" role="tabpanel" aria-labelledby={`insights-tab-${tab}`} className="grid gap-6">
        {tab === "activity" ? (
          <ActivityTab days={search.days} n={n} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !d ? (
          <Skeleton className="h-80 w-full" />
        ) : tab === "posts" ? (
          <PostsTab d={d} n={n} />
        ) : tab === "users" ? (
          <UsersTab d={d} n={n} />
        ) : tab === "diagrams" ? (
          <DiagramsTab d={d} n={n} />
        ) : (
          <ModerationTab d={d} n={n} />
        )}
      </div>
    </>
  );
}
