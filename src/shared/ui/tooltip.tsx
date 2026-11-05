import { Tooltip as T } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export const TooltipProvider = T.Provider;

/** Visual hint only: the trigger must already carry its accessible name. */
export function Tooltip({
  content,
  children,
  side = "top",
  disabled = false,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof T.Content>["side"];
  disabled?: boolean;
  className?: string;
}) {
  if (disabled) return children;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md",
            className,
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
