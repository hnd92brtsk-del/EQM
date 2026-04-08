import * as React from "react";

import { cn } from "../../lib/utils";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenu components must be used within DropdownMenu.");
  return context;
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-flex">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  className,
  asChild,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen } = useDropdownMenuContext();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: cn((children.props as { className?: string }).className, className),
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        (children.props as { onClick?: (event: React.MouseEvent<HTMLElement>) => void }).onClick?.(event);
        if (!event.defaultPrevented) setOpen((current) => !current);
      },
    });
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      className={className}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) setOpen((current) => !current);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useDropdownMenuContext();
  if (!open) return null;
  return (
    <div
      className={cn(
        "absolute right-0 top-[calc(100%+6px)] z-50 min-w-[220px] rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] p-1 text-[var(--eqm-ui-text)] shadow-lg",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eqm-ui-muted)]", className)} {...props} />;
}

export function DropdownMenuGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-0.5", className)} {...props} />;
}

export function DropdownMenuItem({
  className,
  variant,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "destructive" }) {
  const { setOpen } = useDropdownMenuContext();

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-none px-2 py-2 text-sm text-[var(--eqm-ui-text)] transition hover:bg-[var(--eqm-ui-panel-muted)] disabled:pointer-events-none disabled:opacity-50",
        variant === "destructive" && "text-red-600 hover:bg-red-50",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-1 h-px bg-[var(--eqm-ui-border)]", className)} {...props} />;
}
