import * as React from "react";

import { cn } from "../../lib/utils";

type MenubarContextValue = {
  activeMenu: string | null;
  setActiveMenu: React.Dispatch<React.SetStateAction<string | null>>;
};

const MenubarContext = React.createContext<MenubarContextValue | null>(null);
const MenubarMenuContext = React.createContext<{ id: string } | null>(null);

function useMenubarContext() {
  const context = React.useContext(MenubarContext);
  if (!context) throw new Error("Menubar components must be used within Menubar.");
  return context;
}

function useMenubarMenuContext() {
  const context = React.useContext(MenubarMenuContext);
  if (!context) throw new Error("Menubar components must be used within MenubarMenu.");
  return context;
}

export function Menubar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!activeMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeMenu]);

  return (
    <MenubarContext.Provider value={{ activeMenu, setActiveMenu }}>
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-1 rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] p-1 text-[var(--eqm-ui-text)]",
          className
        )}
        {...props}
      />
    </MenubarContext.Provider>
  );
}

export function MenubarMenu({ children }: { children: React.ReactNode }) {
  const id = React.useId();
  return (
    <MenubarMenuContext.Provider value={{ id }}>
      <div className="relative">{children}</div>
    </MenubarMenuContext.Provider>
  );
}

export function MenubarTrigger({ className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { activeMenu, setActiveMenu } = useMenubarContext();
  const { id } = useMenubarMenuContext();
  const isOpen = activeMenu === id;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center rounded-none px-3 text-sm font-medium text-[var(--eqm-ui-text)] transition hover:bg-[var(--eqm-ui-panel-muted)]",
        isOpen && "bg-[var(--eqm-ui-panel-muted)] text-[var(--eqm-ui-text)]",
        className
      )}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setActiveMenu((current) => (current === id ? null : id));
      }}
      {...props}
    />
  );
}

export function MenubarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { activeMenu, setActiveMenu } = useMenubarContext();
  const { id } = useMenubarMenuContext();

  if (activeMenu !== id) return null;

  return (
    <div
      className={cn(
        "absolute left-0 top-[calc(100%+6px)] z-50 min-w-[220px] rounded-none border border-[var(--eqm-ui-border)] bg-[var(--eqm-ui-panel)] p-1 text-[var(--eqm-ui-text)] shadow-lg",
        className
      )}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      {...props}
    >
      <div data-menubar-close="" className="hidden" onClick={() => setActiveMenu(null)} />
      {props.children}
    </div>
  );
}

export function MenubarLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--eqm-ui-muted)]", className)} {...props} />;
}

type MenubarItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  inset?: boolean;
};

export function MenubarItem({ className, inset, onClick, disabled, ...props }: MenubarItemProps) {
  const { setActiveMenu } = useMenubarContext();

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-none px-2 py-2 text-left text-sm text-[var(--eqm-ui-text)] transition hover:bg-[var(--eqm-ui-panel-muted)] disabled:pointer-events-none disabled:opacity-50",
        inset && "pl-7",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setActiveMenu(null);
        }
      }}
      {...props}
    />
  );
}

type MenubarCheckboxItemProps = Omit<MenubarItemProps, "children"> & {
  checked?: boolean;
  children: React.ReactNode;
};

export function MenubarCheckboxItem({ checked, className, children, ...props }: MenubarCheckboxItemProps) {
  return (
    <MenubarItem className={cn("justify-start gap-2", className)} {...props}>
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center border border-[var(--eqm-ui-border-strong)] text-[10px]",
          checked ? "bg-[var(--eqm-ui-accent)] text-[var(--eqm-ui-accent-text)]" : "bg-[var(--eqm-ui-panel)] text-transparent"
        )}
      >
        *
      </span>
      <span className="flex-1">{children}</span>
    </MenubarItem>
  );
}

export function MenubarSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-1 h-px bg-[var(--eqm-ui-border)]", className)} {...props} />;
}

export function MenubarShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto text-xs text-[var(--eqm-ui-muted)]", className)} {...props} />;
}

