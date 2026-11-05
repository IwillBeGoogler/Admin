import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

/**
 * Below `lg` the wrapper scrolls horizontally. Any scrollable overflow makes the
 * wrapper the sticky container (`overflow-y: clip` computes to `hidden` next to
 * `overflow-x: auto`), so on desktop it stays `visible` and the head sticks to the page.
 */
export const Table = ({ className, ...p }: ComponentProps<"table">) => (
  <div className="relative w-full max-lg:overflow-x-auto">
    <table className={cn("w-full caption-bottom text-sm", className)} {...p} />
  </div>
);
/** Sticks under the 56px app header (`top-14`) while the page scrolls. */
export const THead = ({ className, ...p }: ComponentProps<"thead">) => (
  <thead className={cn("sticky top-14 z-10 bg-card [&_tr]:border-b", className)} {...p} />
);
export const TBody = ({ className, ...p }: ComponentProps<"tbody">) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...p} />
);
export const TR = ({ className, ...p }: ComponentProps<"tr">) => (
  <tr
    className={cn(
      "border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-primary/5",
      className,
    )}
    {...p}
  />
);
export const TH = ({ className, ...p }: ComponentProps<"th">) => (
  <th
    scope="col"
    className={cn("h-10 whitespace-nowrap px-3 text-left align-middle font-medium text-muted-foreground", className)}
    {...p}
  />
);
export const TD = ({ className, ...p }: ComponentProps<"td">) => (
  <td className={cn("px-3 py-2.5 align-middle", className)} {...p} />
);
