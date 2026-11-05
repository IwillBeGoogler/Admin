import { useI18n } from "@/shared/i18n";
import { Badge } from "@/shared/ui/badge";
import { type PostStatus, postStatuses } from "../domain/post";

const variant = { draft: "outline", published: "success", scheduled: "warning", unlisted: "secondary" } as const;

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  if (!(postStatuses as readonly string[]).includes(status)) return <Badge variant="outline">{status}</Badge>;
  const s = status as PostStatus;
  return <Badge variant={variant[s]}>{t(`posts.s.${s}`)}</Badge>;
}
