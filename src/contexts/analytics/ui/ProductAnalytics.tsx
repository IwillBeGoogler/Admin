import { lazy, Suspense, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/states";
import { useProductReport } from "../application/queries";
import { funnelRates, pct, readTime, stickiness } from "../domain/product";

const DailyChart = lazy(() => import("./Charts").then((m) => ({ default: m.DailyChart })));
const PERIODS = [7, 30, 90] as const;

function Metric({ label, value, hint }: { label: string; value: string | undefined; hint?: string }) {
  return (
    <Card>
      <CardContent className="grid gap-1 pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        )}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : <p className="h-4" aria-hidden />}
      </CardContent>
    </Card>
  );
}

/** DAU/WAU/MAU, read time, signup funnel and retention from GET /admin/analytics. */
export function ProductAnalytics() {
  const { t, locale } = useI18n();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const q = useProductReport(days);
  const r = q.data;
  const n = (v: number) => formatNumber(v, locale);
  const daily = r ? r.dau.map((d, i) => ({ day: d.day, dau: d.count, signups: r.signups[i]?.count ?? 0 })) : [];
  const empty = r && r.mau === 0 && r.funnel.every((f) => f.count === 0);

  return (
    <section aria-labelledby="product-title" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="product-title" className="text-lg font-semibold">
            {t("product.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("product.note")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          {t("product.period")}
          <select
            className="h-9 rounded-md border bg-background px-2"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as (typeof PERIODS)[number])}
          >
            {PERIODS.map((d) => (
              <option key={d} value={d}>
                {t("product.days", { n: d })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : empty ? (
        <EmptyState title={t("product.empty")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label={t("product.dau")}
              value={r ? n(r.dau.at(-1)?.count ?? 0) : undefined}
              hint={r ? t("product.stickiness", { p: stickiness(r) }) : undefined}
            />
            <Metric label={t("product.wau")} value={r ? n(r.wau) : undefined} />
            <Metric label={t("product.mau")} value={r ? n(r.mau) : undefined} />
            <Metric
              label={t("product.readTime")}
              value={r ? readTime(r.avg_read_seconds) : undefined}
              hint={r ? t("product.readHours", { h: n(Math.round(r.total_read_hours * 10) / 10) }) : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {t("product.dau")} · {t("product.signups")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Suspense fallback={<Skeleton className="h-full w-full" />}>
                    {r ? (
                      <DailyChart data={daily} labels={{ dau: t("product.dau"), signups: t("product.signups") }} />
                    ) : (
                      <Skeleton className="h-full w-full" />
                    )}
                  </Suspense>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("product.funnel")}</CardTitle>
              </CardHeader>
              <CardContent>
                {r ? (
                  <ol className="grid gap-3">
                    {funnelRates(r.funnel).map((s, i, all) => {
                      const top = all[0]?.count || 1;
                      return (
                        <li key={s.step} className="grid gap-1">
                          <div className="flex justify-between text-sm">
                            <span>{t(`product.steps.${s.step}`)}</span>
                            <span className="font-medium tabular-nums">{n(s.count)}</span>
                          </div>
                          <div className="h-2 rounded bg-muted">
                            <div
                              className="h-2 rounded bg-[var(--chart-1)]"
                              style={{ width: `${Math.round((s.count / top) * 100)}%` }}
                            />
                          </div>
                          {i > 0 ? (
                            <p className="text-xs text-muted-foreground">{t("product.conversion", { p: s.rate })}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <Skeleton className="h-40 w-full" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t("product.retention")}</CardTitle>
                {r ? <CardDescription>{t("product.cohort", { n: r.retention.cohort })}</CardDescription> : null}
              </CardHeader>
              <CardContent>
                {r ? (
                  <dl className="grid grid-cols-3 gap-3 text-center">
                    {(["d1", "d7", "d30"] as const).map((k) => (
                      <div key={k} className="rounded-md border p-3">
                        <dt className="text-xs text-muted-foreground">{t(`product.${k}`)}</dt>
                        <dd className="text-xl font-semibold tabular-nums">{pct(r.retention[k])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <Skeleton className="h-16 w-full" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("product.topPages")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm">
                  {r?.top_paths.slice(0, 8).map((p) => (
                    <li key={p.key} className="flex justify-between gap-3">
                      <span className="truncate font-mono text-xs">{p.key || "/"}</span>
                      <span className="tabular-nums">{n(p.count)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("product.languages")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm">
                  {r?.languages.map((l) => (
                    <li key={l.key} className="flex justify-between gap-3">
                      <span className="uppercase">{l.key}</span>
                      <span className="tabular-nums">{n(l.count)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
