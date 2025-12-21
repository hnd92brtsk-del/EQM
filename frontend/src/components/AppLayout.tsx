import React from "react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
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
import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const drawerWidth = 240;

const navItems = [
  { label: "Дашборд", to: "/dashboard", icon: <DashboardRoundedIcon /> },
  { label: "Справочники", to: "/dictionaries", icon: <StorageRoundedIcon /> },
  { label: "Шкафы", to: "/cabinets", icon: <Inventory2RoundedIcon /> },
  { label: "Движения", to: "/movements", icon: <SwapHorizRoundedIcon /> }
];

const adminItems = [
  { label: "Пользователи", to: "/admin/users" },
  { label: "Сессии", to: "/admin/sessions" },
  { label: "Аудит", to: "/admin/audit" }
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggleDrawer = () => setMobileOpen((prev) => !prev);

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        EQM
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
            {user ? `Привет, ${user.username}` : "EQM"}
          </Typography>
          <Button
            color="inherit"
            startIcon={<LogoutRoundedIcon />}
            onClick={logout}
          >
            Выйти
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1 }}>
        <Box
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
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
