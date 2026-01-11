import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, TextField, Typography } from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import authBg from "../assets/auth/auth-bg.jpg";

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
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }
      }}
    >
      <Box
        sx={(theme) => ({
          position: "relative",
          display: { xs: "none", md: "block" },
          backgroundImage: `url(${authBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "common.white"
        })}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: alpha("#000000", 0.45)
          }}
        />
        <Box
          sx={{
            position: "relative",
            p: 6,
            maxWidth: 360
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {t("auth.brandTitle")}
          </Typography>
          <Typography sx={{ mt: 1, color: alpha("#ffffff", 0.75) }}>
            {t("auth.brandSubtitle")}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={(theme) => ({
          backgroundColor: theme.palette.grey[50],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2, md: 6 }
        })}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 460,
            backgroundColor: "common.white",
            border: "1px solid",
            borderColor: "grey.200",
            borderRadius: 0,
            boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
            p: { xs: 3, md: 4 }
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "1px solid",
              borderColor: "grey.200",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
              mb: 2
            }}
          >
            <LockOutlinedIcon fontSize="small" />
          </Box>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2 }}>
            <TextField
              label={t("auth.fields.login")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              fullWidth
              size="medium"
              variant="outlined"
              error={hasError}
              InputLabelProps={{ shrink: true }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 1.5
                },
                "& .MuiInputBase-root": {
                  backgroundColor: "common.white"
                },
                "& .MuiOutlinedInput-input": {
                  padding: "14px 16px"
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(15, 23, 42, 0.18)"
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(15, 23, 42, 0.32)"
                },
                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "primary.main"
                }
              }}
            />
            <TextField
              label={t("auth.fields.password")}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              fullWidth
              size="medium"
              variant="outlined"
              error={hasError}
              InputLabelProps={{ shrink: true }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 1.5
                },
                "& .MuiInputBase-root": {
                  backgroundColor: "common.white"
                },
                "& .MuiOutlinedInput-input": {
                  padding: "14px 16px"
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(15, 23, 42, 0.18)"
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(15, 23, 42, 0.32)"
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
                height: 50,
                borderRadius: 1.5,
                textTransform: "none",
                fontWeight: 600,
                boxShadow: "none",
                backgroundColor: theme.palette.primary.main,
                "&:hover": {
                  backgroundColor: darken(theme.palette.primary.main, 0.12),
                  boxShadow: "none"
                }
              })}
            >
              {t("auth.actions.submit")}
            </AppButton>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: "center", mt: 1.5, lineHeight: 1.4 }}
            >
              {t("auth.helper.accountCreation")}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
