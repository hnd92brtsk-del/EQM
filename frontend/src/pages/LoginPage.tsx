import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Paper,
  TextField
} from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasError = Boolean(error);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        backgroundColor: theme.palette.background.default
      })}
    >
      <Box
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 3, md: 6 },
          backgroundColor: theme.palette.grey[50]
        })}
      >
        <Card
          sx={{
            maxWidth: 480,
            width: "100%",
            borderRadius: 2,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
            backgroundColor: "common.white"
          }}
        >
          <CardContent sx={{ display: "grid", gap: 2.5, p: { xs: 4, md: 5 } }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2 }}>
              <TextField
                label={t("auth.username")}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                error={hasError}
                sx={{
                  "& .MuiInputBase-root": {
                    backgroundColor: "rgba(15, 23, 42, 0.04)"
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(15, 23, 42, 0.16)"
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(15, 23, 42, 0.28)"
                  },
                  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "primary.main"
                  }
                }}
              />
              <TextField
                label={t("auth.password")}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                error={hasError}
                sx={{
                  "& .MuiInputBase-root": {
                    backgroundColor: "rgba(15, 23, 42, 0.04)"
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(15, 23, 42, 0.16)"
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(15, 23, 42, 0.28)"
                  },
                  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "primary.main"
                  }
                }}
              />
              <AppButton
                type="submit"
                variant="contained"
                disabled={loading}
                fullWidth
                sx={(theme) => ({
                  height: 46,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  backgroundColor: theme.palette.primary.main,
                  "&:hover": {
                    backgroundColor: darken(theme.palette.primary.main, 0.12)
                  }
                })}
              >
                {t("auth.signIn")}
              </AppButton>
            </Box>
          </CardContent>
        </Card>
      </Box>
      <Box
        sx={(theme) => ({
          position: "relative",
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: `linear-gradient(145deg, ${alpha(
            theme.palette.primary.dark,
            0.92
          )} 0%, ${alpha(theme.palette.secondary.main, 0.86)} 100%)`
        })}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.22), transparent 55%)"
          }}
        />
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "100%",
            p: 6,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 2,
            color: "common.white"
          }}
        >
          <Box sx={{ position: "absolute", top: 64, right: 80 }}>
            <Paper
              elevation={0}
              sx={{
                width: 220,
                p: 2,
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.92)",
                boxShadow: "0 18px 30px rgba(10, 20, 40, 0.2)"
              }}
            >
              <Box sx={{ height: 10, width: 80, borderRadius: 5, backgroundColor: "grey.200" }} />
              <Box sx={{ mt: 2, height: 70, borderRadius: 2, backgroundColor: "grey.100" }} />
            </Paper>
          </Box>
          <Box sx={{ position: "absolute", top: 210, right: 180 }}>
            <Paper
              elevation={0}
              sx={{
                width: 240,
                p: 2,
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                boxShadow: "0 18px 30px rgba(10, 20, 40, 0.2)"
              }}
            >
              <Box sx={{ height: 8, width: 110, borderRadius: 5, backgroundColor: "grey.200" }} />
              <Box sx={{ mt: 1.5, height: 48, borderRadius: 2, backgroundColor: "grey.100" }} />
              <Box sx={{ mt: 1.5, height: 10, width: 160, borderRadius: 5, backgroundColor: "grey.200" }} />
            </Paper>
          </Box>
          <Box sx={{ position: "absolute", top: 140, right: 16 }}>
            <Paper
              elevation={0}
              sx={{
                width: 180,
                p: 2,
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                boxShadow: "0 18px 30px rgba(10, 20, 40, 0.2)"
              }}
            >
              <Box sx={{ height: 8, width: 90, borderRadius: 5, backgroundColor: "grey.200" }} />
              <Box sx={{ mt: 1.5, height: 36, borderRadius: 2, backgroundColor: "grey.100" }} />
            </Paper>
          </Box>
          <Box sx={{ maxWidth: 360 }}>
            <Box sx={{ typography: "h5", fontWeight: 600 }}>
              {t("auth.promoTitle")}
            </Box>
            <Box sx={{ mt: 1, color: alpha("#ffffff", 0.78) }}>
              {t("auth.promoSubtitle")}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}





