import { useEffect, useState } from "react";
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

export type FieldOption = { label: string; value: number | string };

export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "ports";
  options?: FieldOption[];
  visibleWhen?: (values: Record<string, any>) => boolean;
};

export type DialogState = {
  open: boolean;
  title: string;
  fields: FieldConfig[];
  values: Record<string, any>;
  onSave: (values: Record<string, any>) => void;
};

export function EntityDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const [values, setValues] = useState(state.values);
  const { t } = useTranslation();

  useEffect(() => {
    setValues(state.values);
  }, [state.values]);

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
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>{t("actions.notSelected")}</em>
                  </MenuItem>
                  {field.options?.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
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
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.checked }))
                    }
                  />
                }
                label={field.label}
              />
            );
          }

          if (field.type === "ports") {
            const ports = Array.isArray(values[field.name]) ? values[field.name] : [];
            return (
              <Box key={field.name} sx={{ display: "grid", gap: 1 }}>
                <Box sx={{ fontWeight: 600 }}>{field.label}</Box>
                {ports.map((item: any, index: number) => (
                  <Box
                    key={`${field.name}-${index}`}
                    sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr 120px auto" }}
                  >
                    <FormControl fullWidth>
                      <InputLabel>{t("common.fields.portType")}</InputLabel>
                      <Select
                        label={t("common.fields.portType")}
                        value={item?.type ?? ""}
                        onChange={(event) => {
                          const next = [...ports];
                          next[index] = { ...next[index], type: event.target.value };
                          setValues((prev) => ({ ...prev, [field.name]: next }));
                        }}
                      >
                        <MenuItem value="">
                          <em>{t("actions.notSelected")}</em>
                        </MenuItem>
                        {field.options?.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label={t("common.fields.portCount")}
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
                      fullWidth
                    />
                    <AppButton
                      size="small"
                      color="error"
                      onClick={() => {
                        const next = ports.filter((_: any, i: number) => i !== index);
                        setValues((prev) => ({ ...prev, [field.name]: next }));
                      }}
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
                >
                  {t("actions.add")}
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
                setValues((prev) => ({
                  ...prev,
                  [field.name]:
                    field.type === "number"
                      ? event.target.value === ""
                        ? ""
                        : Number(event.target.value)
                      : event.target.value
                }))
              }
              fullWidth
            />
          );
        })}
      </DialogContent>
      <DialogActions>
        <AppButton onClick={onClose}>{t("actions.cancel")}</AppButton>
        <AppButton onClick={() => state.onSave(values)} variant="contained">
          {t("actions.save")}
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}



