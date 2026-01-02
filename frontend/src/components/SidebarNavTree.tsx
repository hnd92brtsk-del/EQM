import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from "@mui/material";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { isAllowedForRole, findNavChain, NavItem, NavRole } from "../navigation/nav";

type SidebarNavTreeProps = {
  items: NavItem[];
  role?: NavRole;
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
  return patternParts.every((part, index) => {
    if (part.startsWith(":")) {
      return pathParts[index].length > 0;
    }
    return part === pathParts[index];
  });
};

const isActivePath = (item: NavItem, pathname: string) => {
  if (!item.path) {
    return false;
  }
  return matchPathPattern(item.path, pathname);
};

const getItemLabel = (item: NavItem, t: (key: string) => string) => t(item.labelKey);

const renderIcon = (item: NavItem, fallback: React.ElementType) => {
  const Icon = item.icon ?? fallback;
  return <Icon />;
};

export function SidebarNavTree({
  items,
  role,
  level = 0,
  openGroups,
  setOpenGroups
}: SidebarNavTreeProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (!isAllowedForRole(item, role)) {
          return false;
        }
        if (item.showInMenu === false) {
          return false;
        }
        return true;
      }),
    [items, role]
  );

  const handleToggle = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <List sx={{ pl: level ? 1.5 : 0 }}>
      {filteredItems.map((item) => {
        const hasChildren = Boolean(item.children && item.children.length > 0);
        const isActive = isActivePath(item, pathname);
        const isOpen = Boolean(openGroups[item.id]);
        const itemLabel = getItemLabel(item, t);

        if (hasChildren) {
          return (
            <Box key={item.id}>
              <ListItemButton
                onClick={() => handleToggle(item.id)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  pl: level * 2 + 2
                }}
              >
                <ListItemIcon>{renderIcon(item, DashboardRoundedIcon)}</ListItemIcon>
                <ListItemText primary={itemLabel} />
                {isOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              </ListItemButton>
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <SidebarNavTree
                  items={item.children || []}
                  role={role}
                  level={level + 1}
                  openGroups={openGroups}
                  setOpenGroups={setOpenGroups}
                />
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
              "&.active": { backgroundColor: "rgba(30, 58, 95, 0.12)" }
            }}
            selected={isActive}
          >
            <ListItemIcon>{renderIcon(item, Inventory2RoundedIcon)}</ListItemIcon>
            <ListItemText primary={itemLabel} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export function useAutoOpenGroups(items: NavItem[], role?: NavRole) {
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const chain = findNavChain(pathname, items, role);
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
  }, [items, pathname, role]);

  return { openGroups, setOpenGroups };
}
