import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { findNavChain, navTree, NavItem } from "../navigation/nav";
import { useAuth } from "../context/AuthContext";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./ui/menu";

const getLabel = (item: NavItem, t: (key: string) => string) => {
  if (item.labelKey) {
    return t(item.labelKey);
  }
  return item.id;
};

const matchPathPattern = (pattern: string, pathname: string) => {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  return patternParts.every((part, index) => {
    if (part.startsWith(":")) {
      return pathParts[index].length > 0;
    }
    return part === pathParts[index];
  });
};

export function Breadcrumbs() {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const chain = findNavChain(location.pathname, navTree, user);

  const crumbs = [
    { id: "root", label: t("menu.root"), path: "/dashboard" },
    ...chain.map((item) => ({
      id: item.id,
      label: getLabel(item, t),
      path: item.path
    }))
  ];

  if (
    matchPathPattern("/personnel/:id", location.pathname) &&
    !chain.some((item) => item.id === "personnel-details")
  ) {
    crumbs.push({ id: "personnel-details", label: t("pages.personnel_details"), path: "/personnel/:id" });
  }

  const resolvedCrumbs = crumbs.map((crumb) => ({
    ...crumb,
    path: crumb.path?.includes(":") ? location.pathname : crumb.path,
  }));

  const visibleCrumbs =
    resolvedCrumbs.length > 4
      ? [resolvedCrumbs[0], ...resolvedCrumbs.slice(-2)]
      : resolvedCrumbs;
  const hiddenCrumbs =
    resolvedCrumbs.length > 4 ? resolvedCrumbs.slice(1, -2) : [];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {visibleCrumbs.map((crumb, index) => {
          const isLast = index === visibleCrumbs.length - 1;
          const item = crumb.path && !isLast ? (
            <BreadcrumbLink render={<NavLink to={crumb.path} />}>{crumb.label}</BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
          );

          return (
            <React.Fragment key={crumb.id}>
              {index > 0 && <BreadcrumbSeparator />}
              {index === 1 && hiddenCrumbs.length > 0 ? (
                <>
                  <BreadcrumbItem>
                    <Menu>
                      <MenuTrigger
                        render={
                          <Button
                            className="-m-1 h-7 w-7 rounded-md p-0 text-slate-500"
                            size="icon"
                            type="button"
                            variant="ghost"
                          />
                        }
                      >
                        <BreadcrumbEllipsis />
                      </MenuTrigger>
                      <MenuPopup align="start">
                        {hiddenCrumbs.map((hiddenCrumb) => (
                          <MenuItem
                            key={hiddenCrumb.id}
                            render={<NavLink to={hiddenCrumb.path ?? location.pathname} />}
                          >
                            {hiddenCrumb.label}
                          </MenuItem>
                        ))}
                      </MenuPopup>
                    </Menu>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              ) : null}
              <BreadcrumbItem>{item}</BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
