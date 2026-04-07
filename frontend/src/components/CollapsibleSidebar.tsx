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
  drawerWidth = 286,
  handleWidth = 40,
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
                  "linear-gradient(180deg, rgba(33,47,66,1) 0%, rgba(20,30,44,1) 52%, rgba(14,21,31,1) 100%)",
                borderLeft: "1px solid rgba(255,255,255,0.16)",
                boxShadow:
                  "inset 1px 0 0 rgba(255,255,255,0.05), inset 4px 0 0 rgba(244,163,0,0.75)"
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
        <>
          <ChevronRightRoundedIcon
            sx={{
              position: "absolute",
              top: 10,
              right: 4,
              zIndex: 2,
              fontSize: 18,
              color: "rgba(255,255,255,0.72)",
              pointerEvents: "none"
            }}
          />
          <ChevronRightRoundedIcon
            sx={{
              position: "absolute",
              bottom: 10,
              right: 4,
              zIndex: 2,
              fontSize: 18,
              color: "rgba(255,255,255,0.38)",
              pointerEvents: "none"
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 52,
              right: 8,
              zIndex: 2,
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              color: "rgba(245,247,251,0.96)",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              pointerEvents: "none",
              userSelect: "none"
            }}
          >
            Меню
          </span>
        </>
      ) : null}
      {children}
    </Drawer>
  );
}
