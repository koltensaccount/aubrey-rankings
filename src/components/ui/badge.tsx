import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/15 text-primary-text font-semibold",
        accent:
          "border-primary/30 bg-primary/15 text-primary-text font-semibold",
        neutral:
          "border-border bg-muted/80 text-muted-foreground font-medium",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive font-semibold",
        outline: "text-foreground border-border",
        score:
          "border-primary/40 bg-primary/20 text-foreground font-bold font-display",
        success:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold",
        warning:
          "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
