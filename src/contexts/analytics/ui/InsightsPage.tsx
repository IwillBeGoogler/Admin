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
  calendarHeat,
  cumulative,
  engagementPoints,
  INSIGHT_DAYS,
  INSIGHT_TABS,
  type InsightNamed,
  type Insights,
  type InsightsSearch,
  type InsightTab,
  mergeDays,
  pareto,
  type SeriesRow,
  share,
  WEEKDAY_KEYS,
  weekOverWeek,
} from "../domain/insights";

const SeriesChart = lazy(() => import("./Charts").then((m) => ({ default: m.SeriesChart })));
const CategoryChart = lazy(() => import("./Charts").then((m) => ({ default: m.CategoryChart })));
const DonutChart = lazy(() => import("./Charts").then((m) => ({ default: m.DonutChart })));
const LinesChart = lazy(() => import("./Charts").then((m) => ({ default: m.LinesChart })));
const StackedBarsChart = lazy(() => import("./Charts").then((m) => ({ default: m.StackedBarsChart })));
const ParetoChart = lazy(() => import("./Charts").then((m) => ({ default: m.ParetoChart })));
const ScatterPlot = lazy(() => import("./Charts").then((m) => ({ default: m.ScatterPlot })));
const TreemapChart = lazy(() => import("./Charts").then((m) => ({ default: m.TreemapChart })));
const Sparkline = lazy(() => import("./Charts").then((m) => ({ default: m.Sparkline })));
const HeatGrid = lazy(() => import("./Charts").then((m) => ({ default: m.HeatGrid })));
const RadarShape = lazy(() => import("./Charts").then((m) => ({ default: m.RadarShape })));
const Gauge = lazy(() => import("./Charts").then((m) => ({ default: m.Gauge })));

type Fmt = (n: number) => string;

/** Week-over-week change: green up, red down; nothing when there is no earlier week. */
function Delta({ pct }: { pct: number | null }) {
  const { t } = useI18n();
  if (pct === null) return null;
  const tone = pct > 0 ? "text-[var(--chart-1)]" : pct < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={cn("text-xs font-medium tabular-nums", tone)} title={t("insights.wow")}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : "–"} {Math.abs(pct)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  trend,
}: {
  label: string;
  value: string | undefined;
  /** Daily series behind the number: draws a sparkline and a week-over-week change. */
  trend?: { day: string; count: number }[];
}) {
  return (
    <Card className="viz-rise">
      <CardContent className="grid gap-1 pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            {trend ? <Delta pct={weekOverWeek(trend)} /> : null}
          </div>
        )}
        {trend && trend.length > 1 ? (
          <div className="h-8" aria-hidden>
            <Suspense fallback={null}>
              <Sparkline values={trend.slice(-14).map((x) => x.count)} />
            </Suspense>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("viz-rise", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Series({
  title,
  rows,
  series,
  kind = "area",
}: {
  title: string;
  rows: SeriesRow[];
  series: Record<string, string>;
  kind?: "area" | "lines" | "stacked";
}) {
  const { t } = useI18n();
  const Chart = kind === "lines" ? LinesChart : kind === "stacked" ? StackedBarsChart : SeriesChart;
  return (
    <Panel title={title}>
      <div className="h-64">
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <Chart data={rows} series={series} />
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

/** A chart with a fixed-height box, an empty state and a screen-reader table of `rows`. */
function Plot({
  title,
  rows,
  height = 256,
  children,
}: {
  title: string;
  rows: { name: string; count: number }[];
  height?: number;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const empty = rows.every((r) => r.count === 0);
  return (
    <Panel title={title}>
      <div style={{ height }}>
        {empty ? (
          <EmptyState title={t("insights.empty")} />
        ) : (
          <Suspense fallback={<Skeleton className="h-full w-full" />}>{children}</Suspense>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Heat({ title, days }: { title: string; days: { day: string; count: number }[] }) {
  const { t } = useI18n();
  const weeks = calendarHeat(days);
  return (
    <Panel title={title}>
      {weeks.every((w) => w.values.every((v) => v === 0)) ? (
        <p className="text-sm text-muted-foreground">{t("insights.empty")}</p>
      ) : (
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <HeatGrid
            rows={weeks.map((w) => ({ label: w.label, values: w.values }))}
            cols={WEEKDAY_KEYS.map((k) => t(k))}
          />
        </Suspense>
      )}
    </Panel>
  );
}

/** Activity by weekday (Monday first) as a radar. */
function WeekdayRadar({ title, days }: { title: string; days: { day: string; count: number }[] }) {
  const { t } = useI18n();
  const rows = WEEKDAY_KEYS.map((key, i) => ({
    name: t(key),
    count: days
      .filter((d) => (new Date(`${d.day}T00:00:00Z`).getUTCDay() + 6) % 7 === i)
      .reduce((n, d) => n + d.count, 0),
  }));
  return (
    <Plot title={title} rows={rows}>
      <RadarShape data={rows} label={title} />
    </Plot>
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

/** Target time to resolve a report, hours. */
const SLA_HOURS = 24;

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
        <Kpi label={t("insights.posts.total")} value={n(p.total)} trend={p.created} />
        <Kpi label={t("insights.posts.published")} value={n(p.published)} trend={p.published_per_day} />
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
        <Plot
          title={t("insights.posts.status")}
          rows={[
            { name: t("insights.posts.publishedLabel"), count: p.published },
            { name: t("insights.posts.drafts"), count: p.drafts },
          ]}
        >
          <DonutChart
            data={[
              { name: t("insights.posts.publishedLabel"), count: p.published },
              { name: t("insights.posts.drafts"), count: p.drafts },
            ]}
          />
        </Plot>
        <Series
          title={t("insights.posts.createdVsPublished")}
          rows={mergeDays({ created: p.created, published: p.published_per_day })}
          series={{ created: t("insights.posts.created"), published: t("insights.posts.publishedLabel") }}
          kind="stacked"
        />
        <Plot
          title={t("insights.posts.pareto")}
          rows={pareto(p.by_category).map((r) => ({ name: r.name, count: r.count }))}
        >
          <ParetoChart
            data={pareto(p.by_category).slice(0, 8)}
            labels={{ count: t("insights.posts.count"), cum: t("insights.posts.cumulative") }}
          />
        </Plot>
        <Plot title={t("insights.posts.treemap")} rows={p.by_category.map((r) => ({ name: r.key, count: r.count }))}>
          <TreemapChart
            data={p.by_category
              .filter((r) => r.count > 0)
              .map((r) => ({ name: r.key || t("insights.none"), count: r.count }))}
          />
        </Plot>
        <Plot
          title={t("insights.posts.engagement")}
          rows={engagementPoints(p).map((x) => ({ name: x.title, count: x.likes + x.comments }))}
        >
          <ScatterPlot
            data={engagementPoints(p)}
            labels={{ x: t("insights.posts.likesLabel"), y: t("insights.posts.commentsLabel") }}
          />
        </Plot>
        <Heat title={t("insights.posts.commentsHeat")} days={p.comments_per_day} />
        <WeekdayRadar title={t("insights.posts.weekdayRadar")} days={p.published_per_day} />
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
        <Kpi label={t("insights.users.total")} value={n(u.total)} trend={u.signups} />
        <Kpi label={t("insights.users.new")} value={n(u.new)} />
        <Kpi label={t("insights.users.verified")} value={n(u.verified)} />
        <Kpi label={t("insights.users.sanctioned")} value={n(u.sanctioned)} />
      </div>
      <Series
        title={t("insights.users.signups")}
        rows={mergeDays({ signups: u.signups })}
        series={{ signups: t("insights.users.signupsLabel") }}
      />
      <div className={grid2}>
        <Series
          title={t("insights.users.growth")}
          rows={mergeDays({ total: cumulative(u.signups, u.total) })}
          series={{ total: t("insights.users.total") }}
        />
        <Heat title={t("insights.users.signupsHeat")} days={u.signups} />
        <WeekdayRadar title={t("insights.users.weekdayRadar")} days={u.signups} />
        <Plot
          title={t("insights.users.verification", { p: share(u.verified, u.total) })}
          rows={[
            { name: t("insights.users.verified"), count: u.verified },
            { name: t("insights.users.unverified"), count: Math.max(u.total - u.verified, 0) },
          ]}
        >
          <DonutChart
            data={[
              { name: t("insights.users.verified"), count: u.verified },
              { name: t("insights.users.unverified"), count: Math.max(u.total - u.verified, 0) },
            ]}
          />
        </Plot>
        <Plot
          title={t("insights.users.standing", { p: share(u.sanctioned, u.total) })}
          rows={[
            { name: t("insights.users.good"), count: Math.max(u.total - u.sanctioned, 0) },
            { name: t("insights.users.sanctioned"), count: u.sanctioned },
          ]}
        >
          <DonutChart
            data={[
              { name: t("insights.users.good"), count: Math.max(u.total - u.sanctioned, 0) },
              { name: t("insights.users.sanctioned"), count: u.sanctioned },
            ]}
          />
        </Plot>
        <TopList
          title={t("insights.users.topAuthors")}
          rows={u.top_authors.map((a) => ({ key: `@${a.key}`, value: a.count }))}
          n={n}
        />
      </div>
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
        <Plot
          title={t("insights.diagrams.byVisibility")}
          rows={g.by_visibility.map((r) => ({ name: r.key || t("insights.none"), count: r.count }))}
        >
          <DonutChart
            data={g.by_visibility
              .filter((r) => r.count > 0)
              .map((r) => ({ name: r.key || t("insights.none"), count: r.count }))}
          />
        </Plot>
        <Plot title={t("insights.diagrams.kindTreemap")} rows={g.by_kind.map((r) => ({ name: r.key, count: r.count }))}>
          <TreemapChart
            data={g.by_kind
              .filter((r) => r.count > 0)
              .map((r) => ({ name: r.key || t("insights.none"), count: r.count }))}
          />
        </Plot>
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
        kind="lines"
      />
      <div className={grid2}>
        <Panel title={t("insights.moderation.sla", { h: SLA_HOURS })}>
          <div className="h-40">
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <Gauge
                value={m.avg_resolve_hours}
                max={SLA_HOURS}
                warn={SLA_HOURS * 0.75}
                text={t("insights.hours", { n: Math.round(m.avg_resolve_hours * 10) / 10 })}
              />
            </Suspense>
          </div>
        </Panel>
        <Plot
          title={t("insights.moderation.backlog")}
          rows={[
            { name: t("insights.moderation.openReports"), count: m.open_reports },
            { name: t("insights.moderation.openFeedback"), count: m.open_feedback },
            { name: t("insights.moderation.openErrors"), count: m.open_errors },
          ]}
        >
          <DonutChart
            data={[
              { name: t("insights.moderation.openReports"), count: m.open_reports },
              { name: t("insights.moderation.openFeedback"), count: m.open_feedback },
              { name: t("insights.moderation.openErrors"), count: m.open_errors },
            ]}
          />
        </Plot>
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
            kind="stacked"
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
