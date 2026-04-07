import React, { useEffect, useMemo } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
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

const drawerWidth = 286;
const drawerHandleWidth = 40;
const sidebarPinnedKey = "eqm.sidebar.pinned.v2";
const desktopAppBarOffset = 78;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
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
  const { openGroups, setOpenGroups } = useAutoOpenGroups(navSections, user);

  useEffect(() => {
    try {
      localStorage.setItem(sidebarPinnedKey, String(sidebarPinned));
    } catch {
      // Ignore write errors in restrictive environments.
    }
  }, [sidebarPinned]);

  const desktopContentInset = sidebarPinned ? drawerWidth : drawerHandleWidth;
  const userInitial = user?.username?.slice(0, 1).toUpperCase() || "E";

  const drawer = (
    <Box
      sx={{
        p: 2.25,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        color: "#f5f7fb"
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.75,
          mb: 2.25,
          pb: 2,
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 0,
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              color: "#0e1721",
              background: "linear-gradient(135deg, #f4a300 0%, #ffcb66 100%)",
              boxShadow: "0 14px 28px rgba(244,163,0,0.22)"
            }}
          >
            EQ
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="overline" sx={{ color: "rgba(245,247,251,0.62)", lineHeight: 1.1 }}>
              Industrial Control
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "inherit", lineHeight: 1.1 }}>
              {t("app.title")}
            </Typography>
          </Box>
          <Tooltip title={sidebarPinned ? t("sidebar.unpin") : t("sidebar.pin")} placement="right">
            <IconButton
              size="small"
              onClick={() => setSidebarPinned((prev) => !prev)}
              aria-pressed={sidebarPinned}
              sx={{
                color: "inherit",
                borderColor: "rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.04)"
              }}
            >
              {sidebarPinned ? <PushPinRoundedIcon /> : <PushPinOutlinedIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 0.25,
            px: 1.5,
            py: 1.25,
            borderRadius: 0,
            background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            border: "1px solid rgba(255,255,255,0.06)"
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "rgba(245,247,251,0.62)", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Workspace
          </Typography>
          <Typography sx={{ fontWeight: 700, color: "#f5f7fb" }}>
            {user ? t("app.greeting", { name: user.username }) : t("app.title")}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
        <SidebarNavTree
          items={navSections}
          user={user}
          openGroups={openGroups}
          setOpenGroups={setOpenGroups}
        />
      </Box>
    </Box>
  );

  return (
    <Box className="page-shell">
      <AppBar position="fixed" sx={{ zIndex: (currentTheme) => currentTheme.zIndex.drawer + 1 }}>
        <Toolbar
          sx={{
            display: "flex",
            gap: 2,
            minHeight: `${desktopAppBarOffset}px !important`,
            px: { xs: 2, md: 3 }
          }}
        >
          <IconButton
            color="inherit"
            edge="start"
            onClick={toggleDrawer}
            sx={{ display: { md: "none" } }}
          >
            <MenuRoundedIcon />
          </IconButton>

          <Box sx={{ display: "grid", gap: 0.2, flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1 }}>
              EQM Control Center
            </Typography>
            <Typography variant="h6" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user ? t("app.greeting", { name: user.username }) : t("app.title")}
            </Typography>
          </Box>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={i18n.language}
            onChange={(_, value) => value && i18n.changeLanguage(value)}
            aria-label={t("language.label")}
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
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

          <Divider
            orientation="vertical"
            flexItem
            sx={{
              borderColor: alpha(theme.palette.text.secondary, 0.18),
              display: { xs: "none", md: "block" }
            }}
          />
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 1.25,
              pl: 0.5
            }}
          >
            <Avatar
              sx={{
                width: 38,
                height: 38,
                fontSize: 14,
                fontWeight: 800,
                bgcolor: alpha(theme.palette.primary.main, 0.2),
                color: "text.primary"
              }}
            >
              {userInitial}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                {user?.username || t("app.title")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Operations workspace
              </Typography>
            </Box>
          </Box>

          <AppButton variant="contained" startIcon={<LogoutRoundedIcon />} onClick={logout}>
            {t("actions.logout")}
          </AppButton>
        </Toolbar>
      </AppBar>

      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} />

      <Box sx={{ display: "flex", flex: 1 }}>
        <Box component="nav">
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
            topOffset={desktopAppBarOffset}
          >
            {drawer}
          </CollapsibleSidebar>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: { xs: 0, md: `${desktopContentInset}px` },
            transition: "margin-left 200ms ease"
          }}
        >
          <Toolbar sx={{ minHeight: `${desktopAppBarOffset}px !important` }} />
          <Box className="app-content">
            <Breadcrumbs />
            <Box className="content-shell">{children}</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
