import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

export const Card = ({ className, ...p }: ComponentProps<"section">) => (
  <section className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)} {...p} />
);
export const CardHeader = ({ className, ...p }: ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...p} />
);
export const CardTitle = ({ className, ...p }: ComponentProps<"h2">) => (
  <h2 className={cn("text-base font-semibold leading-none", className)} {...p} />
);
export const CardDescription = ({ className, ...p }: ComponentProps<"p">) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...p} />
);
export const CardContent = ({ className, ...p }: ComponentProps<"div">) => (
  <div className={cn("p-5 pt-0", className)} {...p} />
);
