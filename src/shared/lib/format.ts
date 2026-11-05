/** "a, b ,,c" -> ["a","b","c"], lowercased and de-duplicated. */
export const toTags = (s: string): string[] => [
  ...new Set(
    s
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  ),
];

export const formatDate = (iso: string | null | undefined, locale: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/** "3 hours ago" / "in 2 days", localized by Intl.RelativeTimeFormat. */
export const formatRelative = (iso: string | null | undefined, locale: string, now: Date = new Date()): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = (d.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const [unit, secs] = UNITS.find(([, s]) => abs >= s) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" }).format(Math.round(diff / secs), unit);
};

export const formatNumber = (n: number, locale: string): string => new Intl.NumberFormat(locale).format(n);

/** `<input type="datetime-local">` value -> RFC 3339 (UTC). */
export const localInputToRFC3339 = (v: string): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** RFC 3339 -> `<input type="datetime-local">` value in local time. */
export const rfc3339ToLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Count for nav pills and tabs: hidden at 0 (empty string), capped at "99+". */
export const formatBadgeCount = (n: number | undefined): string => (!n || n <= 0 ? "" : n > 99 ? "99+" : String(n));
