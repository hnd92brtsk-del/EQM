import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import type { AuthUser } from "../api/auth";
import { findNavChain, isAllowedForUser, NavItem } from "../navigation/nav";

type SidebarNavTreeProps = {
  items: NavItem[];
  user?: AuthUser | null;
  level?: number;
  openGroups: Record<string, boolean>;
  setOpenGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

const matchPathPattern = (pattern: string, pathname: string) => {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  return patternParts.every((part, index) => (part.startsWith(":") ? pathParts[index].length > 0 : part === pathParts[index]));
};

const isActivePath = (item: NavItem, pathname: string) => Boolean(item.path) && matchPathPattern(item.path!, pathname);
const getItemLabel = (item: NavItem, t: (key: string) => string) => t(item.labelKey);

const renderIcon = (item: NavItem, fallback: React.ElementType, color: string) => {
  const Icon = item.icon ?? fallback;
  return <Icon sx={{ color }} />;
};

export function SidebarNavTree({ items, user, level = 0, openGroups, setOpenGroups }: SidebarNavTreeProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const sidebarTextColor = "rgba(245, 247, 251, 0.96)";
  const sidebarMutedColor = "rgba(245, 247, 251, 0.78)";
  const sidebarDisabledColor = "rgba(245, 247, 251, 0.88)";

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (!isAllowedForUser(item, user)) {
          return false;
        }
        return item.showInMenu !== false;
      }),
    [items, user]
  );

  const handleToggle = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <List sx={{ pl: level ? 1.5 : 0 }}>
      {filteredItems.map((item) => {
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isActive = isActivePath(item, pathname);
        const isOpen = Boolean(openGroups[item.id]);
        const contentId = `sidebar-group-${item.id}`;
        const iconColor = isActive || isOpen ? theme.palette.primary.main : sidebarMutedColor;
        const labelColor = isActive || isOpen ? sidebarTextColor : level > 0 ? sidebarDisabledColor : sidebarMutedColor;
        const itemLabel = getItemLabel(item, t);

        if (hasChildren) {
          return (
            <Box key={item.id}>
              <ListItemButton
                onClick={() => handleToggle(item.id)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  pl: level * 2 + 2,
                  color: sidebarTextColor,
                  "&:hover": { backgroundColor: alpha(theme.palette.common.white, 0.04) },
                  "& .MuiListItemText-primary": { color: sidebarTextColor, fontWeight: isOpen ? 700 : 600 },
                  "& .MuiSvgIcon-root": { color: isOpen ? sidebarTextColor : sidebarMutedColor }
                }}
              >
                <ListItemIcon>{renderIcon(item, DashboardRoundedIcon, iconColor)}</ListItemIcon>
                <ListItemText primary={itemLabel} />
                {isOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              </ListItemButton>
              <Collapse id={contentId} in={isOpen} timeout="auto" unmountOnExit>
                <SidebarNavTree items={item.children || []} user={user} level={level + 1} openGroups={openGroups} setOpenGroups={setOpenGroups} />
              </Collapse>
            </Box>
          );
        }

        if (!item.path) {
          return null;
        }

        return (
          <ListItemButton
            key={item.id}
            component={NavLink}
            to={item.path}
            onClick={() => navigate(item.path as string)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              pl: level * 2 + 2,
              borderLeft: "3px solid transparent",
              "&:hover": { backgroundColor: alpha(theme.palette.common.white, 0.04) },
              "& .MuiListItemText-primary": { fontWeight: isActive ? 600 : 500, color: labelColor },
              "&.active": { backgroundColor: alpha(theme.palette.primary.main, 0.16), borderLeftColor: theme.palette.primary.main }
            }}
            selected={isActive}
          >
            <ListItemIcon>{renderIcon(item, Inventory2RoundedIcon, iconColor)}</ListItemIcon>
            <ListItemText primary={itemLabel} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export function useAutoOpenGroups(items: NavItem[], user?: AuthUser | null) {
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const chain = findNavChain(pathname, items, user);
    const groupIds = chain.filter((item) => item.children && item.children.length > 0).map((item) => item.id);
    if (groupIds.length === 0) {
      return;
    }
    setOpenGroups((prev) => {
      const next = { ...prev };
      groupIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  }, [items, pathname, user]);

  return { openGroups, setOpenGroups };
}
