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
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsInputComponentRoundedIcon from "@mui/icons-material/SettingsInputComponentRounded";
import SignalCellularAltRoundedIcon from "@mui/icons-material/SignalCellularAltRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";

const drawerWidth = 240;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useThemeMode();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleDrawer = () => setMobileOpen((prev) => !prev);

  const navItems = useMemo(
    () => [
      { label: t("nav.dashboard"), to: "/dashboard", icon: <DashboardRoundedIcon /> },
      { label: t("nav.warehouses"), to: "/warehouses", icon: <StorageRoundedIcon /> },
      { label: t("nav.warehouseItems"), to: "/warehouse-items", icon: <StorageRoundedIcon /> },
      { label: t("nav.cabinets"), to: "/cabinets", icon: <Inventory2RoundedIcon /> },
      { label: t("nav.cabinetItems"), to: "/cabinet-items", icon: <Inventory2RoundedIcon /> },
      { label: t("nav.movements"), to: "/movements", icon: <SwapHorizRoundedIcon /> },
      { label: t("nav.ioSignals"), to: "/io-signals", icon: <SignalCellularAltRoundedIcon /> },
      { label: t("nav.dictionaries"), to: "/dictionaries", icon: <SettingsInputComponentRoundedIcon /> }
    ],
    [t, i18n.language]
  );

  const adminItems = useMemo(
    () => [
      { label: t("admin.users"), to: "/admin/users" },
      { label: t("admin.sessions"), to: "/admin/sessions" },
      { label: t("admin.audit"), to: "/admin/audit" }
    ],
    [t, i18n.language]
  );

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {t("app.title")}
      </Typography>
      <List>
        {navItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              "&.active": { backgroundColor: "rgba(30, 58, 95, 0.12)" }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      {user?.role === "admin" && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="overline" color="text.secondary">
            {t("admin.title")}
          </Typography>
          <List>
            {adminItems.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  "&.active": { backgroundColor: "rgba(30, 58, 95, 0.12)" }
                }}
              >
                <ListItemIcon>
                  <AdminPanelSettingsRoundedIcon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
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
          <Box className="app-content">{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}
