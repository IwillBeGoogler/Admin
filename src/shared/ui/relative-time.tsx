import { useI18n } from "@/shared/i18n";
import { formatDate, formatRelative } from "@/shared/lib/format";

/** Relative time with the absolute value in `title` and a machine-readable `dateTime`. */
export function RelativeTime({ value }: { value: string | null | undefined }) {
  const { locale } = useI18n();
  if (!value || Number.isNaN(new Date(value).getTime())) return <span>—</span>;
  return (
    <time dateTime={value} title={formatDate(value, locale)} className="whitespace-nowrap tabular-nums">
      {formatRelative(value, locale)}
    </time>
  );
}
