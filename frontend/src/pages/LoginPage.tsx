import { useLocation, useNavigate } from "react-router-dom";

import { APP_VERSION } from "../appVersion";
import { useAuth } from "../context/AuthContext";
import EQMLogin from "./Login/EQMLogin";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/dashboard";
  const authReason =
    typeof location.state === "object" &&
    location.state !== null &&
    "reason" in location.state &&
    location.state.reason === "expired"
      ? "expired"
      : null;

  const handleLogin = async ({ login: username, password }: { login: string; password: string }) => {
    try {
      await login(username, password);
      navigate(redirectTo, { replace: true });
    } catch {
      throw new Error("Неверный логин или пароль");
    }
  };

  return <EQMLogin onLogin={handleLogin} sessionExpired={authReason === "expired"} version={APP_VERSION} />;
}
