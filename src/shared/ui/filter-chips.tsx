import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/shared/i18n";
import { Badge } from "./badge";
import { Button } from "./button";

export interface FilterChip {
  /** Stable key, usually the search param name. */
  id: string;
  /** Filter name, used in the remove button label. */
  name: string;
  /** Visible value, e.g. "#docker". */
  value: ReactNode;
  onRemove: () => void;
}

/** One chip per active filter, each removing exactly that filter, plus "Reset all". */
export function FilterChips({ chips, onReset }: { chips: FilterChip[]; onReset?: () => void }) {
  const { t } = useI18n();
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
      <ul className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <li key={c.id}>
            <Badge variant="secondary" className="gap-1 py-0.5 pr-0.5 pl-2">
              <span className="text-muted-foreground">{c.name}:</span>
              <span>{c.value}</span>
              <button
                type="button"
                className="grid size-6 place-items-center rounded-full outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("list.removeFilter", { name: c.name })}
                onClick={c.onRemove}
              >
                <XIcon className="size-3" aria-hidden />
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      {onReset ? (
        <Button variant="link" size="sm" className="h-6 px-1" onClick={onReset}>
          {t("list.resetAll")}
        </Button>
      ) : null}
    </div>
  );
}
