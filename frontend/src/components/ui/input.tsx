import * as React from "react";

import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] px-3 py-2 text-sm text-[var(--eqm-ui-text)] outline-none transition placeholder:text-[var(--eqm-ui-muted)] focus:border-[var(--eqm-ui-border-strong)] focus:ring-2 focus:ring-[color:var(--eqm-ui-border)]",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
