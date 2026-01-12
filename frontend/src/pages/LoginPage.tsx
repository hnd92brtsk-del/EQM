import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, TextField, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { AppButton } from "../components/ui/AppButton";
import authBg from "../assets/auth/imgstart2.jpg";

const DarkTextField = styled(TextField)(() => ({
  "& .MuiOutlinedInput-root": {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 0,
    height: 46,
    color: "#fff"
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.25)"
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.45)"
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.7)"
  },
  "& .MuiInputLabel-root": {
    color: "rgba(255,255,255,0.65)"
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "rgba(255,255,255,0.9)"
  },
  "& input": {
    borderRadius: 0,
    caretColor: "#fff",
    color: "#fff"
  },
  "& input::placeholder": {
    color: "rgba(255,255,255,0.6)",
    opacity: 1
  },
  "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active":
    {
      WebkitBoxShadow: "0 0 0 1000px rgba(0,0,0,0.35) inset !important",
      WebkitTextFillColor: "#fff !important",
      caretColor: "#fff !important",
      transition: "background-color 9999s ease-out 0s"
    }
}));

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
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        position: "relative",
        backgroundImage: `url(${authBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <Box
        sx={{
          position: "relative",
          display: { xs: "none", md: "block" },
          color: "common.white"
        }}
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
        sx={{
          backgroundColor: "transparent",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2, md: 6 }
        }}
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
            width: "100%",
            maxWidth: 460,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 0,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            color: "common.white",
            p: { xs: 3, md: 4 },
            position: "relative",
            zIndex: 1
          }}
        >
          <Stack component="form" onSubmit={handleSubmit} spacing={2.5} sx={{ mt: 2 }}>
            <DarkTextField
              label={t("auth.fields.login")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              fullWidth
              size="medium"
              variant="outlined"
              error={hasError}
              InputLabelProps={{ shrink: true }}
              InputProps={{ sx: { backgroundColor: "transparent" } }}
              inputProps={{ style: { color: "#fff" } }}
              sx={{
                "& .MuiOutlinedInput-input": {
                  padding: "14px 16px"
                }
              }}
            />
            <DarkTextField
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
              InputProps={{ sx: { backgroundColor: "transparent" } }}
              inputProps={{ style: { color: "#fff" } }}
              sx={{
                "& .MuiOutlinedInput-input": {
                  padding: "14px 16px"
                }
              }}
            />
            <AppButton
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
              sx={(theme) => ({
                height: 48,
                borderRadius: 0,
                textTransform: "none",
                fontWeight: 600,
                boxShadow: "none",
                backgroundColor: theme.palette.primary.main,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
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
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
