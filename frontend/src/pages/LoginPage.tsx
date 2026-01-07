import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,Card,
  CardContent,
  TextField,
  Typography,
  Alert
} from "@mui/material";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2
      }}
    >
        <Card sx={{ maxWidth: 420, width: "100%" }}>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Typography variant="h5" className="card-title">
            {t("auth.loginTitle")}
          </Typography>
          <Typography color="text.secondary">
            {t("auth.loginHint")}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2 }}>
            <TextField
              label={t("auth.username")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <TextField
              label={t("auth.password")}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <AppButton
              type="submit"
              variant="contained"
              startIcon={<LoginRoundedIcon />}
              disabled={loading}
            >
              {t("auth.signIn")}
            </AppButton>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}





