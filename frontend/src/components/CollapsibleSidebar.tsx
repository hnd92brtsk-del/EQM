import React from "react";
import { Drawer } from "@mui/material";

type CollapsibleSidebarProps = {
  children: React.ReactNode;
  pinned: boolean;
  drawerWidth?: number;
  handleWidth?: number;
};

export function CollapsibleSidebar({
  children,
  pinned,
  drawerWidth = 260,
  handleWidth = 12
}: CollapsibleSidebarProps) {
  const [hovered, setHovered] = React.useState(false);
  const isOpen = pinned || hovered;
  const offset = drawerWidth - handleWidth;

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
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          borderRight: "none",
          overflowX: "hidden",
          transform: `translateX(${isOpen ? 0 : -offset}px)`,
          transition: "transform 200ms ease, width 200ms ease"
        }
      }}
      PaperProps={{
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
      {children}
    </Drawer>
  );
}
