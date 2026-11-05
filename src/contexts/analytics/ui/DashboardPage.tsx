import { FileTextIcon, FolderIcon, HeartIcon, MessageSquareIcon, UsersIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { useCategories } from "@/contexts/content";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/shared/ui/states";
import { useStats } from "../application/queries";
import { ratios, type Stats, shareOf, topN } from "../domain/stats";
import { ProductAnalytics } from "./ProductAnalytics";

const TotalsChart = lazy(() => import("./Charts").then((m) => ({ default: m.TotalsChart })));
const CategoryChart = lazy(() => import("./Charts").then((m) => ({ default: m.CategoryChart })));

const cards = [
  { key: "posts", icon: FileTextIcon },
  { key: "comments", icon: MessageSquareIcon },
  { key: "likes", icon: HeartIcon },
  { key: "users", icon: UsersIcon },
  { key: "categories", icon: FolderIcon },
] as const satisfies readonly { key: keyof Stats; icon: unknown }[];

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | undefined;
  icon: typeof FileTextIcon;
  hint?: string | undefined;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {value === undefined ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          )}
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : <p className="h-4" aria-hidden />}
        </div>
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </CardContent>
    </Card>
  );
}

const ChartBox = ({ children }: { children: React.ReactNode }) => (
  <div className="h-72">
    <Suspense fallback={<Skeleton className="h-full w-full" />}>{children}</Suspense>
  </div>
);

export function DashboardPage() {
  const { t, locale } = useI18n();
  const stats = useStats();
  const categories = useCategories();
  const s = stats.data;
  const r = s ? ratios(s) : undefined;
  const hints: Partial<Record<keyof Stats, string>> = r
    ? {
        likes: `${t("stats.likesPerPost")}: ${r.likesPerPost}`,
        comments: `${t("stats.commentsPerPost")}: ${r.commentsPerPost}`,
      }
    : {};
  const byCategory = topN(
    (categories.data ?? []).map((c) => ({ name: c.name, count: c.count })),
    8,
    t("stats.other"),
  );

  return (
    <>
      <PageHeader title={t("stats.title")} />
      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="grid gap-6">
          <section aria-label={t("stats.chart")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((c) => (
              <StatCard
                key={c.key}
                label={t(`stats.${c.key}`)}
                icon={c.icon}
                value={s ? formatNumber(s[c.key], locale) : undefined}
                hint={hints[c.key]}
              />
            ))}
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("stats.chart")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartBox>
                  {s ? (
                    <TotalsChart data={cards.map((c) => ({ name: t(`stats.${c.key}`), count: s[c.key] }))} />
                  ) : (
                    <Skeleton className="h-full w-full" />
                  )}
                </ChartBox>
                {s ? (
                  <table className="sr-only">
                    <caption>{t("stats.chart")}</caption>
                    <tbody>
                      {cards.map((c) => (
                        <tr key={c.key}>
                          <th scope="row">{t(`stats.${c.key}`)}</th>
                          <td>{s[c.key]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("stats.topCategories")}</CardTitle>
                {s && byCategory[0] ? (
                  <CardDescription>
                    {byCategory[0].name}: {t("stats.share", { p: shareOf(byCategory[0].count, s.posts) })}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                {categories.isError ? (
                  <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
                ) : categories.data && byCategory.length === 0 ? (
                  <div className="h-72">
                    <EmptyState title={t("categories.empty")} />
                  </div>
                ) : (
                  <ChartBox>
                    {categories.data ? <CategoryChart data={byCategory} /> : <Skeleton className="h-full w-full" />}
                  </ChartBox>
                )}
                {byCategory.length ? (
                  <table className="sr-only">
                    <caption>{t("stats.topCategories")}</caption>
                    <tbody>
                      {byCategory.map((c) => (
                        <tr key={c.name}>
                          <th scope="row">{c.name}</th>
                          <td>{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </CardContent>
            </Card>
          </div>
          <ProductAnalytics />
        </div>
      )}
    </>
  );
}
