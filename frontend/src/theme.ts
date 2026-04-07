import { createTheme, type PaletteMode } from "@mui/material";
import { alpha } from "@mui/material/styles";

type DesignTokens = {
  shell: string;
  shellAccent: string;
  shellEdge: string;
  appBar: string;
  appBarBorder: string;
  appBarGlow: string;
  panel: string;
  panelAlt: string;
  panelMuted: string;
  panelBorder: string;
  panelBorderStrong: string;
  pageOverlay: string;
  shadowSoft: string;
  shadowCard: string;
  shadowPanel: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  chartPalette: string[];
};

const TOKENS: Record<PaletteMode, DesignTokens> = {
  light: {
    shell: "#0f1824",
    shellAccent: "#17273a",
    shellEdge: "rgba(255,255,255,0.08)",
    appBar: "rgba(245, 247, 250, 0.84)",
    appBarBorder: "rgba(19, 34, 53, 0.08)",
    appBarGlow: "linear-gradient(90deg, rgba(244, 163, 0, 0.18), rgba(70, 124, 186, 0.12), transparent)",
    panel: "rgba(255,255,255,0.92)",
    panelAlt: "#f5f7fa",
    panelMuted: "#eef3f8",
    panelBorder: "rgba(18, 36, 58, 0.08)",
    panelBorderStrong: "rgba(18, 36, 58, 0.14)",
    pageOverlay: "radial-gradient(circle at top left, rgba(244,163,0,0.12), transparent 28%), radial-gradient(circle at top right, rgba(70,124,186,0.12), transparent 22%)",
    shadowSoft: "0 24px 60px rgba(11, 24, 41, 0.08)",
    shadowCard: "0 20px 48px rgba(11, 24, 41, 0.12)",
    shadowPanel: "0 28px 60px rgba(4, 12, 24, 0.22)",
    success: "#1fb67a",
    warning: "#e7a43b",
    danger: "#de5b56",
    info: "#4f8fdd",
    chartPalette: ["#f4a300", "#4377b6", "#18a37c", "#d7654b", "#9176d4", "#65a7d4"]
  },
  dark: {
    shell: "#0b131d",
    shellAccent: "#111f30",
    shellEdge: "rgba(255,255,255,0.06)",
    appBar: "rgba(9, 17, 27, 0.84)",
    appBarBorder: "rgba(205, 220, 237, 0.08)",
    appBarGlow: "linear-gradient(90deg, rgba(244, 163, 0, 0.24), rgba(77, 137, 211, 0.2), transparent)",
    panel: "rgba(18, 29, 42, 0.9)",
    panelAlt: "#101a26",
    panelMuted: "#142232",
    panelBorder: "rgba(211, 223, 237, 0.08)",
    panelBorderStrong: "rgba(211, 223, 237, 0.14)",
    pageOverlay: "radial-gradient(circle at top left, rgba(244,163,0,0.14), transparent 28%), radial-gradient(circle at top right, rgba(77,137,211,0.16), transparent 22%)",
    shadowSoft: "0 28px 64px rgba(0, 0, 0, 0.28)",
    shadowCard: "0 26px 58px rgba(0, 0, 0, 0.34)",
    shadowPanel: "0 36px 80px rgba(0, 0, 0, 0.5)",
    success: "#2ac28d",
    warning: "#ebb049",
    danger: "#f06d67",
    info: "#6ba9ff",
    chartPalette: ["#f4a300", "#68a6ff", "#2ac28d", "#ff8668", "#b294ff", "#74c8e8"]
  }
};

const getScrollbarStyles = (mode: PaletteMode, tokens: DesignTokens) => {
  const thumb = mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(14, 27, 42, 0.18)";
  const thumbHover = mode === "dark" ? "rgba(255,255,255,0.3)" : "rgba(14, 27, 42, 0.32)";

  return {
    ":root": {
      colorScheme: mode,
      "--eqm-shell": tokens.shell,
      "--eqm-shell-accent": tokens.shellAccent,
      "--eqm-shell-edge": tokens.shellEdge,
      "--eqm-appbar-glow": tokens.appBarGlow,
      "--eqm-panel": tokens.panel,
      "--eqm-panel-alt": tokens.panelAlt,
      "--eqm-panel-muted": tokens.panelMuted,
      "--eqm-panel-border": tokens.panelBorder,
      "--eqm-panel-border-strong": tokens.panelBorderStrong,
      "--eqm-page-overlay": tokens.pageOverlay,
      "--eqm-shadow-soft": tokens.shadowSoft,
      "--eqm-shadow-card": tokens.shadowCard,
      "--eqm-shadow-panel": tokens.shadowPanel
    },
    "*, *::before, *::after": {
      borderRadius: "0 !important"
    },
    body: {
      margin: 0,
      scrollbarWidth: "thin",
      scrollbarColor: `${thumb} transparent`
    },
    "*": {
      scrollbarWidth: "thin",
      scrollbarColor: `${thumb} transparent`
    },
    "*::-webkit-scrollbar": {
      width: 10,
      height: 10
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
  const tokens = TOKENS[mode];
  const primaryMain = "#f4a300";
  const primaryDark = "#d88d08";
  const secondaryMain = "#4f8fdd";
  const textPrimary = isDark ? "#edf4ff" : "#152235";
  const textSecondary = isDark ? "#97a7bc" : "#5e7189";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryMain,
        dark: primaryDark,
        light: "#ffcb66",
        contrastText: "#0b1118"
      },
      secondary: {
        main: secondaryMain,
        light: "#83b7f4",
        dark: "#2f6aa9"
      },
      success: { main: tokens.success },
      warning: { main: tokens.warning },
      error: { main: tokens.danger },
      info: { main: tokens.info },
      background: {
        default: isDark ? "#0a121b" : "#eef2f6",
        paper: tokens.panel
      },
      divider: tokens.panelBorderStrong,
      text: {
        primary: textPrimary,
        secondary: textSecondary
      }
    },
    shape: {
      borderRadius: 0
    },
    typography: {
      fontFamily: '"Manrope", "Segoe UI", "Noto Sans", sans-serif',
      h3: { fontWeight: 800, letterSpacing: "-0.03em" },
      h4: { fontWeight: 800, letterSpacing: "-0.03em" },
      h5: { fontWeight: 750, letterSpacing: "-0.02em" },
      h6: { fontWeight: 700, letterSpacing: "-0.01em" },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
      button: { fontWeight: 700, letterSpacing: "0.01em", textTransform: "none" }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: getScrollbarStyles(mode, tokens)
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.appBar,
            color: textPrimary,
            borderBottom: `1px solid ${tokens.appBarBorder}`,
            backdropFilter: "blur(20px)",
            boxShadow: "none"
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: `linear-gradient(180deg, ${tokens.shellAccent} 0%, ${tokens.shell} 100%)`,
            color: "#f5f8fc",
            borderRight: `1px solid ${tokens.shellEdge}`,
            boxShadow: tokens.shadowPanel
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            borderRadius: 0,
            border: `1px solid ${tokens.panelBorder}`,
            boxShadow: tokens.shadowSoft
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: `linear-gradient(180deg, ${alpha(isDark ? "#203145" : "#ffffff", isDark ? 0.98 : 0.92)} 0%, ${tokens.panel} 100%)`,
            borderRadius: 0,
            border: `1px solid ${tokens.panelBorder}`,
            boxShadow: tokens.shadowCard,
            overflow: "hidden"
          }
        }
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 24,
            "&:last-child": {
              paddingBottom: 24
            }
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            paddingInline: 18,
            minHeight: 42,
            boxShadow: "none"
          },
          contained: {
            boxShadow: `0 14px 30px ${alpha(primaryMain, 0.24)}`
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${primaryMain} 0%, #ffb42f 100%)`,
            color: "#10161e",
            "&:hover": {
              boxShadow: `0 18px 34px ${alpha(primaryMain, 0.28)}`,
              background: `linear-gradient(135deg, #e49a0d 0%, #ffbc43 100%)`
            }
          },
          outlined: {
            borderColor: tokens.panelBorderStrong,
            backgroundColor: alpha(isDark ? "#ffffff" : "#f8fbff", isDark ? 0.02 : 0.72)
          },
          text: {
            color: textSecondary,
            "&:hover": {
              backgroundColor: alpha(primaryMain, 0.08),
              color: textPrimary
            }
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            border: `1px solid ${tokens.panelBorder}`,
            backgroundColor: alpha(isDark ? "#ffffff" : "#f8fbff", isDark ? 0.03 : 0.82)
          }
        }
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            backgroundColor: alpha(isDark ? "#ffffff" : "#f7fbff", isDark ? 0.04 : 0.72),
            border: `1px solid ${tokens.panelBorder}`
          }
        }
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: "0 !important",
            color: textSecondary,
            border: 0,
            "&.Mui-selected": {
              backgroundColor: alpha(primaryMain, 0.18),
              color: textPrimary
            }
          }
        }
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            borderRadius: 0
          },
          input: {
            "&::placeholder": {
              opacity: 1,
              color: textSecondary
            }
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(isDark ? "#0e1824" : "#fbfdff", isDark ? 0.84 : 0.92),
            transition: "border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: tokens.panelBorderStrong
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(primaryMain, 0.48)
            },
            "&.Mui-focused": {
              boxShadow: `0 0 0 4px ${alpha(primaryMain, 0.14)}`
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(primaryMain, 0.85)
            }
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: textSecondary
          }
        }
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            border: `1px solid ${tokens.panelBorder}`,
            backgroundColor: alpha(isDark ? "#0f1824" : "#fefefe", isDark ? 0.55 : 0.92)
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${tokens.panelBorder}`,
            paddingTop: 14,
            paddingBottom: 14
          },
          head: {
            position: "sticky",
            top: 0,
            zIndex: 1,
            backgroundColor: alpha(isDark ? "#132131" : "#f6f9fc", isDark ? 0.94 : 0.96),
            color: textPrimary,
            fontWeight: 800,
            fontSize: "0.77rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            borderBottom: `1px solid ${tokens.panelBorderStrong}`
          }
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: "background-color 150ms ease, transform 150ms ease",
            "&:hover": {
              backgroundColor: alpha(primaryMain, 0.05)
            }
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 48,
            backgroundColor: alpha(isDark ? "#ffffff" : "#f8fbff", isDark ? 0.04 : 0.72),
            borderRadius: 0,
            padding: 6,
            border: `1px solid ${tokens.panelBorder}`
          },
          indicator: {
            height: "100%",
            borderRadius: 0,
            backgroundColor: alpha(primaryMain, 0.16),
            zIndex: 0
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            zIndex: 1,
            minHeight: 40,
            borderRadius: 0,
            fontWeight: 700,
            textTransform: "none",
            color: textSecondary,
            "&.Mui-selected": {
              color: textPrimary
            }
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            border: `1px solid ${tokens.panelBorder}`,
            boxShadow: tokens.shadowPanel
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            fontWeight: 700
          }
        }
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            "&.Mui-checked": {
              color: primaryMain
            },
            "&.Mui-checked + .MuiSwitch-track": {
              backgroundColor: alpha(primaryMain, 0.5)
            }
          },
          track: {
            backgroundColor: alpha(textSecondary, 0.28)
          }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 0,
            backgroundColor: isDark ? "#132131" : "#14253a"
          }
        }
      },
      MuiBadge: {
        styleOverrides: {
          badge: {
            borderRadius: 0
          }
        }
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            borderRadius: 0
          }
        }
      }
    }
  });
}
