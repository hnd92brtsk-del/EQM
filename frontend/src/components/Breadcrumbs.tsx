import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from "@mui/material";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { findNavChain, navTree, NavItem } from "../navigation/nav";
import { useAuth } from "../context/AuthContext";

const getLabel = (item: NavItem, t: (key: string) => string) => {
  if (item.labelKey) {
    return t(item.labelKey);
  }
  if (item.labelRu) {
    return item.labelRu;
  }
  if (item.labelEn) {
    return item.labelEn;
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
    { id: "root", label: t("menu.root"), path: undefined },
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
    crumbs.push({ id: "personnel-details", label: t("pages.personnel_details"), path: undefined });
  }

  return (
    <MuiBreadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        if (!crumb.path || isLast) {
          return (
            <Typography color="text.primary" key={crumb.id}>
              {crumb.label}
            </Typography>
          );
        }
        return (
          <Link component={NavLink} to={crumb.path} key={crumb.id} underline="hover">
            {crumb.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
}
