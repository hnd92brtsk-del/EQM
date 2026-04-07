import { useEffect, useRef } from "react";
import { notifyError } from "./AppNotifications";

export function ErrorSnackbar({
  message,
  onClose
}: {
  message: string | null;
  onClose: () => void;
}) {
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message || message === lastMessageRef.current) return;
    lastMessageRef.current = message;
    notifyError(message);
    onClose();
  }, [message, onClose]);

  useEffect(() => {
    if (!message) {
      lastMessageRef.current = null;
    }
  }, [message]);

  return null;
}
