import * as React from "react";
import {
  Menu as MuiMenu,
  MenuItem as MuiMenuItem,
  type MenuProps as MuiMenuProps,
} from "@mui/material";

import { cn } from "../../lib/utils";

type RenderProp = React.ReactElement<any>;

type MenuContextValue = {
  anchorEl: HTMLElement | null;
  open: boolean;
  openMenu: (event: React.MouseEvent<HTMLElement>) => void;
  closeMenu: () => void;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);

function useMenuContext() {
  const context = React.useContext(MenuContext);
  if (!context) {
    throw new Error("Menu components must be used within Menu");
  }
  return context;
}

function composeHandlers<E>(
  original: ((event: E) => void) | undefined,
  next: (event: E) => void
) {
  return (event: E) => {
    original?.(event);
    next(event);
  };
}

export function Menu({ children }: { children: React.ReactNode }) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const value = React.useMemo(
    () => ({
      anchorEl,
      open: Boolean(anchorEl),
      openMenu: (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
      closeMenu: () => setAnchorEl(null),
    }),
    [anchorEl]
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function MenuTrigger({
  children,
  render,
}: {
  children: React.ReactNode;
  render: RenderProp;
}) {
  const { open, openMenu } = useMenuContext();

  return React.cloneElement(render, {
    className: cn(render.props.className),
    onClick: composeHandlers(render.props.onClick, openMenu),
    "aria-expanded": open ? "true" : undefined,
    "aria-haspopup": "menu",
    children,
  });
}

export function MenuPopup({
  align = "center",
  children,
  ...props
}: Omit<MuiMenuProps, "open" | "anchorEl" | "onClose" | "children"> & {
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const { anchorEl, open, closeMenu } = useMenuContext();

  const horizontal = align === "start" ? "left" : align === "end" ? "right" : "center";

  return (
    <MuiMenu
      anchorEl={anchorEl}
      open={open}
      onClose={closeMenu}
      anchorOrigin={{ vertical: "bottom", horizontal }}
      transformOrigin={{ vertical: "top", horizontal }}
      MenuListProps={{ "aria-label": "Hidden breadcrumb items" }}
      {...props}
    >
      {children}
    </MuiMenu>
  );
}

export function MenuItem({
  children,
  className,
  onClick,
  render,
  ...props
}: React.ComponentPropsWithoutRef<typeof MuiMenuItem> & { render?: RenderProp }) {
  const { closeMenu } = useMenuContext();

  const handleClick = (event: React.MouseEvent<HTMLLIElement>) => {
    onClick?.(event);
    closeMenu();
  };

  if (render) {
    return (
      <MuiMenuItem className={cn("p-0", className)} onClick={handleClick} {...props}>
        {React.cloneElement(render, {
          onClick: composeHandlers(render.props.onClick, () => closeMenu()),
          className: cn(
            "block w-full px-4 py-1.5 text-sm text-slate-700 no-underline",
            render.props.className
          ),
          children,
        })}
      </MuiMenuItem>
    );
  }

  return (
    <MuiMenuItem className={className} onClick={handleClick} {...props}>
      {children}
    </MuiMenuItem>
  );
}
