import { Alert, Snackbar } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import i18n from "../i18n";
import { normalizeErrorMessage } from "../utils/errorMessage";

export type NotificationKind = "success" | "error" | "info" | "warning";

type NotificationItem = {
  id: number;
  kind: NotificationKind;
  message: string;
};

type NotificationListener = (item: NotificationItem) => void;

const listeners = new Set<NotificationListener>();
let nextId = 1;

function emit(item: NotificationItem) {
  listeners.forEach((listener) => listener(item));
}

function subscribe(listener: NotificationListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notify(input: { kind: NotificationKind; message: string }) {
  emit({ ...input, id: nextId++ });
}

export function notifySuccess(message = i18n.t("notifications.success.default")) {
  notify({ kind: "success", message });
}

export function notifyError(errorOrMessage: unknown, fallback?: string) {
  notify({ kind: "error", message: normalizeErrorMessage(errorOrMessage, fallback) });
}

export function AppNotificationsHost() {
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const [current, setCurrent] = useState<NotificationItem | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => subscribe((item) => setQueue((prev) => [...prev, item])), []);

  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((prev) => prev.slice(1));
  }, [current, queue]);

  useEffect(() => {
    if (!current) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(
      () => setCurrent(null),
      current.kind === "error" ? 7000 : 3200,
    );

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [current]);

  return (
    <Snackbar
      open={Boolean(current)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      onClose={() => setCurrent(null)}
    >
      <Alert
        severity={current?.kind || "info"}
        variant="filled"
        onClose={() => setCurrent(null)}
        sx={{ minWidth: 360, maxWidth: "min(92vw, 720px)" }}
      >
        {current?.message}
      </Alert>
    </Snackbar>
  );
}
