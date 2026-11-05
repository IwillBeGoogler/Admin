import { SearchIcon, XIcon } from "lucide-react";
import { type ComponentProps, useRef } from "react";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Input } from "./input";

export const kbdClass = "rounded border border-border px-1.5 font-mono text-[11px] text-muted-foreground";

/**
 * Search field with an explicit clear button and the `/` shortcut hint.
 * List pages focus `input[data-list-search]` when `/` is pressed.
 */
export function SearchInput({
  value,
  onValueChange,
  className,
  ...p
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
      <Input
        ref={ref}
        type="search"
        data-list-search=""
        className="pl-8 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onValueChange("");
          }
        }}
        {...p}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center">
        {value && !p.disabled ? (
          <button
            type="button"
            className="grid size-6 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("list.clearSearch")}
            onClick={() => {
              onValueChange("");
              ref.current?.focus();
            }}
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        ) : (
          <kbd aria-hidden className={cn(kbdClass, "mr-1")}>
            /
          </kbd>
        )}
      </div>
    </div>
  );
}
