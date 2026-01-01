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
