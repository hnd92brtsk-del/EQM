import * as React from "react";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";

import { cn } from "../../lib/utils";

type RenderProp = React.ReactElement<{ className?: string; children?: React.ReactNode }>;

function mergeClassName(className: string | undefined, render: RenderProp) {
  return cn(className, render.props.className);
}

export function Breadcrumb({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return <nav aria-label="breadcrumb" className={cn("mb-2", className)} {...props} />;
}

export function BreadcrumbList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"ol">) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm text-slate-500",
        className
      )}
      {...props}
    />
  );
}

export function BreadcrumbItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"li">) {
  return <li className={cn("inline-flex items-center gap-1.5", className)} {...props} />;
}

export function BreadcrumbLink({
  className,
  children,
  render,
  ...props
}: React.ComponentPropsWithoutRef<"a"> & { render?: RenderProp }) {
  const linkClassName = cn(
    "inline-flex items-center rounded-none px-1 py-0.5 text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
    className
  );

  if (render) {
    return React.cloneElement(render, {
      ...props,
      className: mergeClassName(linkClassName, render),
      children
    });
  }

  return (
    <a className={linkClassName} {...props}>
      {children}
    </a>
  );
}

export function BreadcrumbPage({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return <span className={cn("font-medium text-slate-950", className)} aria-current="page" {...props} />;
}

export function BreadcrumbSeparator({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"li">) {
  return (
    <li
      aria-hidden="true"
      className={cn("inline-flex items-center text-slate-400", className)}
      {...props}
    >
      {children ?? <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />}
    </li>
  );
}

export function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)} {...props}>
      <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
      <span className="sr-only">More</span>
    </span>
  );
}
