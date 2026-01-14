import { createTheme, type PaletteMode } from "@mui/material";
import { alpha } from "@mui/material/styles";

const getScrollbarStyles = (mode: PaletteMode) => {
  const isDark = mode === "dark";
  const thumb = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.25)";
  const thumbHover = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.38)";

  return {
    body: {
      scrollbarWidth: "thin",
      scrollbarColor: `${thumb} transparent`
    },
    "*": {
      scrollbarWidth: "thin",
      scrollbarColor: `${thumb} transparent`
    },
    "*::-webkit-scrollbar": {
      width: 8,
      height: 8
    },
    "*::-webkit-scrollbar-track": {
      background: "transparent"
    },
    "*::-webkit-scrollbar-thumb": {
      backgroundColor: thumb,
      borderRadius: 999,
      border: "2px solid transparent",
      backgroundClip: "content-box"
    },
    "*::-webkit-scrollbar-thumb:hover": {
      backgroundColor: thumbHover
    }
  };
};

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? "#f4a300" : "#f4a300" },
      secondary: { main: isDark ? "#2ba3ff" : "#2ba3ff" },
      success: { main: isDark ? "#00c49a" : "#00c49a" },
      background: {
        default: isDark ? "#0f141b" : "#f5f7fb",
        paper: isDark ? "#16202c" : "#FFFFFF"
      },
      text: {
        primary: isDark ? "#e6eef8" : "#1c2430",
        secondary: isDark ? "#8c98ab" : "#7b8797"
      }
    },
    typography: {
      fontFamily: '"Manrope", "Roboto", "Segoe UI", "Noto Sans", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 }
    },
    shape: {
      borderRadius: 14
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: getScrollbarStyles(mode)
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? "#101720" : "#101720",
            borderRight: "1px solid rgba(255, 255, 255, 0.06)"
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            color: isDark ? "#e6eef8" : "#e6eef8",
            "&.Mui-selected": {
              backgroundColor: alpha(isDark ? "#f4a300" : "#f4a300", 0.12)
            },
            "&.Mui-selected:hover": {
              backgroundColor: alpha(isDark ? "#f4a300" : "#f4a300", 0.18)
            }
          }
        }
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            color: isDark ? "#8c98ab" : "#8c98ab",
            minWidth: 36
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 12
          },
          containedPrimary: {
            backgroundColor: isDark ? "#f4a300" : "#f4a300",
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: isDark ? "#dc9300" : "#dc9300"
            }
          },
          outlinedPrimary: {
            borderColor: isDark ? "#f4a300" : "#f4a300",
            color: isDark ? "#f4a300" : "#f4a300",
            "&:hover": {
              backgroundColor: alpha(isDark ? "#f4a300" : "#f4a300", 0.08),
              borderColor: isDark ? "#f4a300" : "#f4a300"
            }
          },
          textPrimary: {
            color: isDark ? "#8c98ab" : "#7b8797",
            "&:hover": {
              color: isDark ? "#f4a300" : "#f4a300",
              backgroundColor: alpha(isDark ? "#f4a300" : "#f4a300", 0.08)
            }
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#172230" : "#FFFFFF",
            borderRadius: 16,
            boxShadow: isDark
              ? "0 10px 30px rgba(2, 14, 28, 0.35)"
              : "0 8px 24px rgba(15, 23, 42, 0.08)"
          }
        }
      }
    }
  });
}
