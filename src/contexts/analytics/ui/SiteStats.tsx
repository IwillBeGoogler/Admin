import { lazy, Suspense } from "react";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { useSiteStats } from "../application/queries";
import { noViews } from "../domain/siteStats";

const ViewsChart = lazy(() => import("./Charts").then((m) => ({ default: m.ViewsChart })));

const totals = [
  { key: "post_views", label: "postViews" },
  { key: "diagram_views", label: "diagramViews" },
  { key: "visitors", label: "visitors" },
  { key: "posts", label: "posts" },
  { key: "diagrams", label: "diagrams" },
  { key: "users", label: "users" },
] as const;

/** Post and diagram views, site totals and top lists from GET /admin/stats/site. */
export function SiteStats() {
  const { t, locale } = useI18n();
  const q = useSiteStats(10);
  const s = q.data;
  const n = (v: number) => formatNumber(v, locale);
  const daily = s?.days.map((d) => ({ day: d.day, posts: d.post_views, diagrams: d.diagram_views, pages: d.page_views }));

  return (
    <section aria-labelledby="site-title" className="grid gap-4">
      <div>
        <h2 id="site-title" className="text-lg font-semibold">
          {t("site.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("site.note")}</p>
      </div>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : s && noViews(s) ? (
        <EmptyState title={t("site.empty")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {totals.map((c) => (
              <Card key={c.key}>
                <CardContent className="grid gap-1 pt-5">
                  <p className="text-sm text-muted-foreground">{t(`site.${c.label}`)}</p>
                  {s ? (
                    <p className="text-2xl font-semibold tabular-nums">{n(s.totals[c.key])}</p>
                  ) : (
                    <Skeleton className="h-8 w-16" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("site.viewsChart")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  {daily ? (
                    <ViewsChart
                      data={daily}
                      labels={{ posts: t("site.postViews"), diagrams: t("site.diagramViews"), pages: t("site.pageViews") }}
                    />
                  ) : (
                    <Skeleton className="h-full w-full" />
                  )}
                </Suspense>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("site.topPosts")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-1 text-sm">
                  {s?.top_posts.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3">
                      <span className="truncate">
                        {p.title} <span className="text-muted-foreground">@{p.author}</span>
                      </span>
                      <span className="tabular-nums">{n(p.views)}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("site.topDiagrams")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-1 text-sm">
                  {s?.top_diagrams.map((d) => (
                    <li key={d.slug} className="flex justify-between gap-3">
                      <span className="truncate">
                        {d.title} <span className="text-muted-foreground">@{d.author}</span>
                      </span>
                      <span className="tabular-nums">{n(d.views)}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
