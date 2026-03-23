import { createTheme, type PaletteMode } from "@mui/material";
import { alpha } from "@mui/material/styles";

const getScrollbarStyles = (mode: PaletteMode) => {
  const isDark = mode === "dark";
  const thumb = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.25)";
  const thumbHover = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.38)";

  return {
    "*, *::before, *::after": {
      borderRadius: "0 !important"
    },
    ".MuiAvatar-root, .MuiAvatar-root::before, .MuiAvatar-root::after, .MuiBadge-badge, .MuiBadge-badge::before, .MuiBadge-badge::after, .keep-rounded, .keep-rounded::before, .keep-rounded::after, .rounded-full, [class*='rounded-full'], [class*='rounded-full']::before, [class*='rounded-full']::after": {
      borderRadius: "9999px !important"
    },
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
      borderRadius: 0
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: getScrollbarStyles(mode)
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? "#101720" : "#101720",
            borderRight: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 0
          }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            color: isDark ? "#e6eef8" : "#f5f7fb",
            borderRadius: 0,
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
            borderRadius: 0
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
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            borderRadius: 0
          },
          grouped: {
            borderRadius: "0 !important"
          }
        }
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      },
      MuiBadge: {
        styleOverrides: {
          badge: {
            borderRadius: 9999
          }
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 0
          }
        }
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 0
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 0
          }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 0
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#172230" : "#FFFFFF",
            borderRadius: 0,
            boxShadow: isDark
              ? "0 10px 30px rgba(2, 14, 28, 0.35)"
              : "0 8px 24px rgba(15, 23, 42, 0.08)"
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: isDark ? alpha("#8fb4ff", 0.12) : alpha("#1f4b99", 0.08),
            color: isDark ? "#f4f7fb" : "#21304a",
            fontWeight: 800,
            borderBottom: `1px solid ${alpha(isDark ? "#c9d8ec" : "#24406f", isDark ? 0.2 : 0.14)}`,
            backdropFilter: "blur(8px)"
          }
        }
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            borderRadius: "0 !important"
          }
        }
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      }
    }
  });
}
