import { createTheme, type PaletteMode } from "@mui/material";

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: "#1E3A5F" },
      secondary: { main: "#D97B41" },
      background: {
        default: isDark ? "#0F131A" : "#F3F0EA",
        paper: isDark ? "#151B26" : "#FFFFFF"
      },
      text: {
        primary: isDark ? "#E6EEF8" : "#1F2A44",
        secondary: isDark ? "#A8B3C7" : "#5C6B82"
      }
    },
    typography: {
      fontFamily: '"Manrope", "Segoe UI", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 }
    },
    shape: {
      borderRadius: 14
    }
  });
}
