import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-surface-3 text-muted-foreground",
        blue: "border-primary/40 bg-primary/10 text-[#8fb2ff]",
        cyan: "border-cyan/40 bg-cyan/10 text-cyan",
        green: "border-success/40 bg-success/10 text-success",
        amber: "border-warning/40 bg-warning/10 text-warning",
        red: "border-danger/40 bg-danger/10 text-[#ff8a8a]",
        violet: "border-violet/40 bg-violet/10 text-violet",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
