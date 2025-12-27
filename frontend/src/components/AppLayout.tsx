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

  const navSections = useMemo(
    () => [
      {
        title: null,
        items: [{ label: "Overview", to: "/dashboard", icon: <DashboardRoundedIcon /> }]
      },
      {
        title: "Оборудование",
        items: [{ label: "Складские позиции", to: "/warehouse-items", icon: <StorageRoundedIcon /> }]
      },
      {
        title: "Шкафы",
        items: [{ label: "Шкафные позиции", to: "/cabinet-items", icon: <Inventory2RoundedIcon /> }]
      },
      {
        title: "Engineering",
        items: [
          { label: "IO Signals", to: "/io-signals", icon: <SignalCellularAltRoundedIcon /> },
          { label: "DCL", to: "/engineering/dcl", icon: <SettingsInputComponentRoundedIcon /> }
        ]
      },
      {
        title: "Dictionaries",
        items: [
          { label: "Warehouses", to: "/warehouses", icon: <StorageRoundedIcon /> },
          { label: "Cabinets", to: "/cabinets", icon: <Inventory2RoundedIcon /> },
          { label: "Manufacturers", to: "/dictionaries/manufacturers", icon: <SettingsInputComponentRoundedIcon /> },
          { label: "???? ????????????", to: "/dictionaries/equipment-categories", icon: <SettingsInputComponentRoundedIcon /> },
          { label: "Nomenclature", to: "/dictionaries/equipment-types", icon: <SettingsInputComponentRoundedIcon /> },
          { label: "Locations", to: "/dictionaries/locations", icon: <SettingsInputComponentRoundedIcon /> }
        ]
      }
    ],
    []
  );

  const adminItems = useMemo(
    () => [
      { label: "Users", to: "/admin/users" },
      { label: "Sessions", to: "/admin/sessions" },
      { label: "Audit Logs", to: "/admin/audit" }
    ],
    []
  );

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        {t("app.title")}
      </Typography>
      <List>
        {navSections.map((section) => (
          <Box key={section.title ?? "overview"}>
            {section.title && (
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", mt: 2, mb: 0.5, px: 2 }}
              >
                {section.title}
              </Typography>
            )}
            {section.items.map((item) => (
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
          </Box>
        ))}
      </List>

      {user?.role === "admin" && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="overline" color="text.secondary">
            Admin
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
