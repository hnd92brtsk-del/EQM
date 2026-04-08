import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eqm-ui-border-strong)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--eqm-ui-accent)] text-[var(--eqm-ui-accent-text)] hover:brightness-110",
        secondary: "bg-[var(--eqm-ui-panel-muted)] text-[var(--eqm-ui-text)] hover:brightness-105",
        outline: "border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] text-[var(--eqm-ui-text)] hover:bg-[var(--eqm-ui-panel-alt)]",
        ghost: "text-[var(--eqm-ui-text)] hover:bg-[var(--eqm-ui-panel-muted)]",
        destructive: "bg-red-500 text-white hover:bg-red-600",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";

export { Button, buttonVariants };
