import { useState } from "react";
import type { ReactNode } from "react";
import { CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

import { getApiUrl, getToken } from "../api/client";
import { AppButton } from "./ui/AppButton";
import { ErrorSnackbar } from "./ErrorSnackbar";

type ProtectedDownloadLinkProps = {
  url: string | null;
  filename?: string | null;
  label?: string;
  icon?: ReactNode;
  variant?: "text" | "outlined" | "contained";
  size?: "small" | "medium";
};

export function ProtectedDownloadLink({
  url,
  filename,
  label,
  icon,
  variant = "text",
  size = "small"
}: ProtectedDownloadLinkProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!url) {
    return <span>—</span>;
  }

  const buttonLabel = label || filename || t("actions.download");

  const handleDownload = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(getApiUrl(url), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!response.ok) {
        throw new Error(t("errors.downloadFailed"));
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("errors.downloadFailed");
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppButton
        onClick={handleDownload}
        variant={variant}
        size={size}
        startIcon={loading ? <CircularProgress size={14} /> : icon}
        disabled={loading}
      >
        {buttonLabel}
      </AppButton>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </>
  );
}
