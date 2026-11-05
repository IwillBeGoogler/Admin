import { DropdownMenu as M } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

export const Dropdown = M.Root;
export const DropdownTrigger = M.Trigger;
export function DropdownContent({ className, ...p }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={6}
        className={cn(
          "z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
          className,
        )}
        {...p}
      />
    </M.Portal>
  );
}
export const DropdownItem = ({ className, ...p }: ComponentProps<typeof M.Item>) => (
  <M.Item
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50 [&_svg]:size-4",
      className,
    )}
    {...p}
  />
);
export const DropdownRadioGroup = M.RadioGroup;
export const DropdownRadioItem = ({ className, children, ...p }: ComponentProps<typeof M.RadioItem>) => (
  <M.RadioItem
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none relative data-[highlighted]:bg-accent",
      className,
    )}
    {...p}
  >
    <M.ItemIndicator className="absolute left-2">•</M.ItemIndicator>
    {children}
  </M.RadioItem>
);
export const DropdownLabel = ({ className, ...p }: ComponentProps<typeof M.Label>) => (
  <M.Label className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...p} />
);
export const DropdownSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
