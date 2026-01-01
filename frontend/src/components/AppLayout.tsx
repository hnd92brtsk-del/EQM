import React, { useMemo } from "react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  Button
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { isAllowedForRole, navTree } from "../navigation/nav";

const drawerWidth = 240;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useThemeMode();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleDrawer = () => setMobileOpen((prev) => !prev);

  const navSections = useMemo(() => navTree, []);

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {t("app.title")}
      </Typography>
      <List>
        {navSections
          .filter((section) => isAllowedForRole(section, user?.role))
          .map((section) => {
            const children =
              section.children?.filter(
                (item) => isAllowedForRole(item, user?.role) && item.showInMenu !== false
              ) ?? [];
            if (section.path && section.showInMenu !== false) {
              const SectionIcon = section.icon ?? DashboardRoundedIcon;
              return (
                <Box key={section.id}>
                  <ListItemButton
                    component={NavLink}
                    to={section.path}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      "&.active": { backgroundColor: "rgba(30, 58, 95, 0.12)" }
                    }}
                  >
                    <ListItemIcon>
                      <SectionIcon />
                    </ListItemIcon>
                    <ListItemText primary={t(section.labelKey)} />
                  </ListItemButton>
                </Box>
              );
            }
            if (children.length === 0) {
              return null;
            }
            return (
              <Box key={section.id}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: "block", mt: 2, mb: 0.5, px: 2 }}
                >
                  {t(section.labelKey)}
                </Typography>
                {children.map((item) => {
                  const ItemIcon = item.icon ?? Inventory2RoundedIcon;
                  return (
                  <ListItemButton
                    key={item.id}
                    component={NavLink}
                    to={item.path || "#"}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      "&.active": { backgroundColor: "rgba(30, 58, 95, 0.12)" }
                    }}
                    disabled={!item.path}
                  >
                    <ListItemIcon>
                      <ItemIcon />
                    </ListItemIcon>
                    <ListItemText primary={t(item.labelKey)} />
                  </ListItemButton>
                  );
                })}
              </Box>
            );
          })}
      </List>
    </Box>
  );

  return (
    <Box className="page-shell">
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ display: "flex", gap: 2 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={toggleDrawer}
            sx={{ display: { md: "none" } }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {user ? t("app.greeting", { name: user.username }) : t("app.title")}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={i18n.language}
            onChange={(_, value) => value && i18n.changeLanguage(value)}
            aria-label={t("language.label")}
            sx={{ backgroundColor: "rgba(255, 255, 255, 0.08)", borderRadius: 2 }}
          >
            <ToggleButton value="ru">{t("language.ru")}</ToggleButton>
            <ToggleButton value="en">{t("language.en")}</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={t(mode === "light" ? "theme.dark" : "theme.light")}>
            <IconButton color="inherit" onClick={toggleTheme}>
              {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Button color="inherit" startIcon={<LogoutRoundedIcon />} onClick={logout}>
            {t("actions.logout")}
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1 }}>
        <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={toggleDrawer}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: "block", md: "none" },
              "& .MuiDrawer-paper": { width: drawerWidth }
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: "none", md: "block" },
              "& .MuiDrawer-paper": { width: drawerWidth, borderRight: "none" }
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box component="main" sx={{ flexGrow: 1 }}>
          <Toolbar />
          <Box className="app-content">
            <Breadcrumbs />
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
