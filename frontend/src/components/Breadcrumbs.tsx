import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from "@mui/material";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { findNavChain, navTree, NavItem } from "../navigation/nav";
import { useAuth } from "../context/AuthContext";

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
  const chain = findNavChain(location.pathname, navTree, user?.role);

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

  return (
    <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      {crumbs.map((crumb) => {
        const resolvedPath = crumb.path?.includes(":") ? location.pathname : crumb.path;
        if (!resolvedPath) {
          return (
            <Typography color="text.primary" key={crumb.id}>
              {crumb.label}
            </Typography>
          );
        }
        return (
          <Link component={NavLink} to={resolvedPath} key={crumb.id} underline="hover">
            {crumb.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}
