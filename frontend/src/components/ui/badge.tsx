import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-none px-2.5 py-1 text-[11px] font-semibold", {
  variants: {
    variant: {
      default: "bg-[var(--eqm-ui-accent)] text-[var(--eqm-ui-accent-text)]",
      secondary: "bg-[var(--eqm-ui-panel-muted)] text-[var(--eqm-ui-text)]",
      outline: "border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] text-[var(--eqm-ui-text)]",
      destructive: "bg-red-500 text-white",
      success: "bg-emerald-100 text-emerald-700",
      warning: "bg-amber-100 text-amber-700",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
