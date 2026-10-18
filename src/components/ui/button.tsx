import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-surface text-foreground border border-border hover:bg-surface-elevated shadow-xs",
        primary:
          "bg-primary text-primary-foreground font-bold hover:bg-primary-hover shadow-sm",
        destructive:
          "bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30",
        outline:
          "border border-border bg-transparent hover:bg-surface text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-elevated border border-border/60",
        ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
        link: "text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 sm:h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 sm:h-12 rounded-xl px-6 text-sm sm:text-base",
        icon: "h-9 w-9 sm:h-10 sm:w-10 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-md text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
