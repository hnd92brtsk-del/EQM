import { Alert, Snackbar } from "@mui/material";

export function ErrorSnackbar({
  message,
  onClose
}: {
  message: string | null;
  onClose: () => void;
}) {
  return (
    <Snackbar open={Boolean(message)} autoHideDuration={6000} onClose={onClose}>
      <Alert severity="error" onClose={onClose} variant="filled">
        {message}
      </Alert>
    </Snackbar>
  );
}
