import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField
} from "@mui/material";
import { AppButton } from "./ui/AppButton";
import { ErrorSnackbar } from "./ErrorSnackbar";

export type FieldOption = { label: string; value: number | string; disabled?: boolean };

export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "ports";
  options?: FieldOption[];
  portsLabels?: {
    title?: string;
    add?: string;
    portType?: string;
    count?: string;
  };
  visibleWhen?: (values: Record<string, any>) => boolean;
  disabledWhen?: (values: Record<string, any>) => boolean;
  onChange?: (value: any, values: Record<string, any>) => Record<string, any> | void;
};

export type DialogState = {
  open: boolean;
  title: string;
  fields: FieldConfig[];
  values: Record<string, any>;
  onSave: (values: Record<string, any>) => Promise<void> | void;
  renderExtra?: () => ReactNode;
};

export function EntityDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const [values, setValues] = useState(state.values);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    setValues(state.values);
  }, [state.values]);

  const applyFieldChange = (field: FieldConfig, value: any) => {
    setValues((prev) => {
      const next = { ...prev, [field.name]: value };
      const extra = field.onChange ? field.onChange(value, next) : null;
      return extra ? { ...next, ...extra } : next;
    });
  };

  return (
    <Dialog open={state.open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{state.title}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
        {state.fields.map((field) => {
          if (field.visibleWhen && !field.visibleWhen(values)) {
            return null;
          }

          if (field.type === "select") {
            return (
              <FormControl key={field.name} fullWidth>
                <InputLabel>{field.label}</InputLabel>
                <Select
                  label={field.label}
                  value={values[field.name] ?? ""}
                  onChange={(event) => applyFieldChange(field, event.target.value)}
                  disabled={saving || field.disabledWhen?.(values)}
                >
                  <MenuItem value="">
                    <em>{t("actions.notSelected")}</em>
                  </MenuItem>
                  {field.options?.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            );
          }

          if (field.type === "checkbox") {
            return (
              <FormControlLabel
                key={field.name}
                control={
                  <Checkbox
                    checked={Boolean(values[field.name])}
                    onChange={(event) => applyFieldChange(field, event.target.checked)}
                    disabled={saving || field.disabledWhen?.(values)}
                  />
                }
                label={field.label}
              />
            );
          }

          if (field.type === "ports") {
            const ports = Array.isArray(values[field.name]) ? values[field.name] : [];
            const portTypeLabel = field.portsLabels?.portType || t("common.fields.portType");
            const portCountLabel = field.portsLabels?.count || t("common.fields.portCount");
            const portsTitle = field.portsLabels?.title || field.label;
            const addLabel = field.portsLabels?.add || t("actions.add");
            return (
              <Box key={field.name} sx={{ display: "grid", gap: 1 }}>
                <Box sx={{ fontWeight: 600 }}>{portsTitle}</Box>
                {ports.map((item: any, index: number) => (
                  <Box
                    key={`${field.name}-${index}`}
                    sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 120px auto" }}
                  >
                    <FormControl fullWidth>
                      <InputLabel>{portTypeLabel}</InputLabel>
                      <Select
                        label={portTypeLabel}
                        value={item?.type ?? ""}
                        onChange={(event) => {
                          const next = [...ports];
                          next[index] = { ...next[index], type: event.target.value };
                          setValues((prev) => ({ ...prev, [field.name]: next }));
                        }}
                        disabled={saving}
                      >
                        <MenuItem value="">
                          <em>{t("actions.notSelected")}</em>
                        </MenuItem>
                        {field.options?.map((option) => (
                          <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label={portCountLabel}
                      type="number"
                      value={item?.count ?? 0}
                      onChange={(event) => {
                        const next = [...ports];
                        next[index] = {
                          ...next[index],
                          count: event.target.value === "" ? "" : Number(event.target.value)
                        };
                        setValues((prev) => ({ ...prev, [field.name]: next }));
                      }}
                      disabled={saving}
                      fullWidth
                    />
                    <AppButton
                      size="small"
                      color="error"
                      onClick={() => {
                        const next = ports.filter((_: any, i: number) => i !== index);
                        setValues((prev) => ({ ...prev, [field.name]: next }));
                      }}
                      disabled={saving}
                    >
                      {t("actions.delete")}
                    </AppButton>
                  </Box>
                ))}
                <AppButton
                  size="small"
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      [field.name]: [...ports, { type: "", count: 0 }]
                    }))
                  }
                  disabled={saving}
                >
                  {addLabel}
                </AppButton>
              </Box>
            );
          }

          return (
            <TextField
              key={field.name}
              label={field.label}
              type={field.type}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                applyFieldChange(
                  field,
                  field.type === "number"
                    ? event.target.value === ""
                      ? ""
                      : Number(event.target.value)
                    : event.target.value
                )
              }
              disabled={saving || field.disabledWhen?.(values)}
              fullWidth
            />
          );
        })}
        {state.renderExtra ? <Box sx={{ mt: 2 }}>{state.renderExtra()}</Box> : null}
      </DialogContent>
      <DialogActions>
        <AppButton onClick={onClose} disabled={saving}>
          {t("actions.cancel")}
        </AppButton>
        <AppButton
          onClick={async () => {
            setSaving(true);
            try {
              await state.onSave(values);
              onClose();
            } catch (error) {
              setErrorMessage(
                error instanceof Error ? error.message : t("errors.saveFailed")
              );
            } finally {
              setSaving(false);
            }
          }}
          variant="contained"
          disabled={saving}
        >
          {t("actions.save")}
        </AppButton>
      </DialogActions>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage(null)} />
    </Dialog>
  );
}



