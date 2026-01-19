import React, { useEffect, useMemo } from "react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { navTree } from "../navigation/nav";
import { SidebarNavTree, useAutoOpenGroups } from "./SidebarNavTree";
import { AppButton } from "./ui/AppButton";
import ChatDialog from "./ChatDialog";
import { CollapsibleSidebar } from "./CollapsibleSidebar";

const drawerWidth = 260;
const drawerHandleWidth = 12;
const sidebarPinnedKey = "eqm.sidebar.pinned";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useThemeMode();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [sidebarPinned, setSidebarPinned] = React.useState(() => {
    try {
      return localStorage.getItem(sidebarPinnedKey) === "true";
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();

  const toggleDrawer = () => setMobileOpen((prev) => !prev);

  const navSections = useMemo(() => navTree, []);
  const { openGroups, setOpenGroups } = useAutoOpenGroups(navSections, user?.role);

  useEffect(() => {
    try {
      localStorage.setItem(sidebarPinnedKey, String(sidebarPinned));
    } catch {
      // Ignore write errors in restrictive environments.
    }
  }, [sidebarPinned]);

  const drawer = (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {t("app.title")}
        </Typography>
        <Tooltip
          title={sidebarPinned ? t("sidebar.unpin") : t("sidebar.pin")}
          placement="right"
        >
          <IconButton
            size="small"
            onClick={() => setSidebarPinned((prev) => !prev)}
            aria-pressed={sidebarPinned}
          >
            {sidebarPinned ? <PushPinRoundedIcon /> : <PushPinOutlinedIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      <SidebarNavTree
        items={navSections}
        role={user?.role}
        openGroups={openGroups}
        setOpenGroups={setOpenGroups}
      />
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
          <Tooltip title={t("menu.help")}>
            <IconButton color="inherit" onClick={() => navigate("/help")}>
              <HelpOutlineRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("menu.chat")}>
            <IconButton color="inherit" onClick={() => setChatOpen(true)}>
              <ChatRoundedIcon />
            </IconButton>
          </Tooltip>
          <AppButton color="inherit" startIcon={<LogoutRoundedIcon />} onClick={logout}>
            {t("actions.logout")}
          </AppButton>
        </Toolbar>
      </AppBar>
      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} />

      <Box sx={{ display: "flex", flex: 1 }}>
        <Box
          component="nav"
          sx={{ width: { xs: 0, md: drawerHandleWidth }, flexShrink: { md: 0 } }}
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
          <CollapsibleSidebar
            pinned={sidebarPinned}
            drawerWidth={drawerWidth}
            handleWidth={drawerHandleWidth}
          >
            {drawer}
          </CollapsibleSidebar>
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



