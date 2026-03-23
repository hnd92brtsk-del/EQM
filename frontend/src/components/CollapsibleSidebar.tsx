import React from "react";
import { Drawer } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

type CollapsibleSidebarProps = {
  children: React.ReactNode;
  pinned: boolean;
  drawerWidth?: number;
  handleWidth?: number;
  topOffset?: number;
};

export function CollapsibleSidebar({
  children,
  pinned,
  drawerWidth = 260,
  handleWidth = 12,
  topOffset = 64
}: CollapsibleSidebarProps) {
  const [hovered, setHovered] = React.useState(false);
  const isOpen = pinned || hovered;
  const offset = drawerWidth - handleWidth;
  const height = `calc(100vh - ${topOffset}px)`;

  React.useEffect(() => {
    if (pinned) {
      setHovered(false);
    }
  }, [pinned]);

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        display: { xs: "none", md: "block" },
        width: 0,
        flexShrink: 0,
        pointerEvents: "none",
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          height,
          maxHeight: height,
          top: `${topOffset}px`,
          left: 0,
          position: "fixed",
          borderRight: "none",
          overflowX: "hidden",
          overflowY: "hidden",
          backgroundColor: "#111923",
          transform: `translateX(${isOpen ? 0 : -offset}px)`,
          transition: "transform 200ms ease, box-shadow 200ms ease",
          boxSizing: "border-box",
          pointerEvents: "auto",
          boxShadow: isOpen ? "0 10px 30px rgba(15, 23, 42, 0.28)" : "none",
          "&::after": !isOpen
            ? {
                content: '""',
                position: "absolute",
                top: 0,
                right: 0,
                width: handleWidth,
                height: "100%",
                background:
                  "linear-gradient(180deg, rgba(17,25,35,1) 0%, rgba(12,19,29,1) 100%)",
                borderLeft: "1px solid rgba(255,255,255,0.08)"
              }
            : undefined
        }
      }}
      PaperProps={{
        sx: {
          position: "fixed"
        },
        onMouseEnter: () => {
          if (!pinned) {
            setHovered(true);
          }
        },
        onMouseLeave: () => {
          if (!pinned) {
            setHovered(false);
          }
        }
      }}
    >
      {!isOpen ? (
        <ChevronRightRoundedIcon
          sx={{
            position: "absolute",
            top: 20,
            right: 0,
            zIndex: 1,
            width: handleWidth,
            fontSize: 14,
            color: "rgba(255,255,255,0.55)",
            pointerEvents: "none"
          }}
        />
      ) : null}
      {children}
    </Drawer>
  );
}
