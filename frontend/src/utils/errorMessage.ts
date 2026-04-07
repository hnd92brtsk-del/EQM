import i18n from "../i18n";

export type UiError = Error & {
  status?: number;
  statusText?: string;
  body?: string;
  rawMessage?: string;
};

type HttpErrorInput = {
  status?: number;
  statusText?: string;
  body?: string;
  fallbackMessage?: string;
};

function tryExtractDetail(body?: string) {
  if (!body) return "";

  try {
    const parsed = JSON.parse(body) as
      | { detail?: unknown; message?: unknown; error?: unknown }
      | Array<unknown>;

    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).join("; ");
    }

    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg?: unknown }).msg ?? "");
          }
          return String(item);
        })
        .filter(Boolean)
        .join("; ");
    }
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    return body.trim();
  }

  return "";
}

function normalizeKnownMessage(message: string) {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return "";
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network error")) {
    return i18n.t("notifications.errors.network");
  }
  if (lower.includes("upload failed")) {
    return i18n.t("notifications.errors.upload");
  }
  if (lower.includes("download failed")) {
    return i18n.t("notifications.errors.download");
  }
  if (lower.includes("delete failed")) {
    return i18n.t("notifications.errors.delete");
  }
  if (lower.includes("request failed")) {
    return i18n.t("notifications.errors.request");
  }

  return trimmed;
}

function normalizeHttpStatus(status?: number, detail?: string) {
  if (!status) return detail || i18n.t("notifications.errors.generic");
  if (status === 401) return detail || i18n.t("notifications.errors.unauthorized");
  if (status === 403) return detail || i18n.t("notifications.errors.forbidden");
  if (status === 404) return detail || i18n.t("notifications.errors.notFound");
  if (status === 422) return detail || i18n.t("notifications.errors.validation");
  if (status >= 500) return detail || i18n.t("notifications.errors.server");
  return detail || i18n.t("notifications.errors.request");
}

export function normalizeErrorMessage(errorOrMessage: unknown, fallback?: string) {
  if (typeof errorOrMessage === "string") {
    return normalizeKnownMessage(errorOrMessage) || fallback || i18n.t("notifications.errors.generic");
  }

  if (errorOrMessage instanceof Error) {
    const error = errorOrMessage as UiError;
    const detailFromBody = normalizeKnownMessage(tryExtractDetail(error.body));
    if (error.status) {
      return normalizeHttpStatus(error.status, detailFromBody);
    }

    const knownMessage = normalizeKnownMessage(error.message);
    return knownMessage || fallback || i18n.t("notifications.errors.generic");
  }

  return fallback || i18n.t("notifications.errors.generic");
}

export function buildHttpError({
  status,
  statusText,
  body,
  fallbackMessage,
}: HttpErrorInput) {
  const detail = tryExtractDetail(body);
  const error = new Error(normalizeHttpStatus(status, normalizeKnownMessage(detail)));
  const uiError = error as UiError;
  uiError.status = status;
  uiError.statusText = statusText;
  uiError.body = body;
  uiError.rawMessage = detail || fallbackMessage || "";
  return uiError;
}
