import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  List,
  ListItemButton,
  ListItemText,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Box,
  IconButton,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  TextField,
  Typography
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { AppButton } from "./ui/AppButton";
import { ErrorSnackbar } from "./ErrorSnackbar";

export type FieldOption = { label: string; value: number | string; disabled?: boolean };
export type TreeFieldOption = {
  label: string;
  value: number | string;
  disabled?: boolean;
  children?: TreeFieldOption[];
};

export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "ports" | "treeSelect";
  multiline?: boolean;
  rows?: number;
  min?: number;
  step?: number | "any";
  placeholder?: string;
  options?: FieldOption[];
  treeOptions?: TreeFieldOption[];
  leafOnly?: boolean;
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
  renderExtra?: (values: Record<string, any>) => ReactNode;
};

export function EntityDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const [values, setValues] = useState(state.values);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [treeSelectAnchor, setTreeSelectAnchor] = useState<HTMLElement | null>(null);
  const [activeTreeField, setActiveTreeField] = useState<FieldConfig | null>(null);
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Record<string, boolean>>({});
  const { t } = useTranslation();

  useEffect(() => {
    setValues(state.values);
  }, [state.values]);

  useEffect(() => {
    setTreeSelectAnchor(null);
    setActiveTreeField(null);
    setExpandedTreeNodes({});
  }, [state]);

  const applyFieldChange = (field: FieldConfig, value: any) => {
    setValues((prev) => {
      const next = { ...prev, [field.name]: value };
      const extra = field.onChange ? field.onChange(value, next) : null;
      return extra ? { ...next, ...extra } : next;
    });
  };

  const toggleTreeNode = (fieldName: string, nodeValue: number | string) => {
    const key = `${fieldName}:${String(nodeValue)}`;
    setExpandedTreeNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildTreeLabelMap = (options: TreeFieldOption[] | undefined, path: string[] = []) => {
    const map = new Map<number | string, string>();
    (options || []).forEach((option) => {
      const nextPath = [...path, option.label];
      map.set(option.value, nextPath.join(" / "));
      const nestedMap = buildTreeLabelMap(option.children, nextPath);
      nestedMap.forEach((value, key) => map.set(key, value));
    });
    return map;
  };

  const renderTreeOptions = (
    options: TreeFieldOption[],
    field: FieldConfig,
    depth = 0
  ): ReactNode =>
    options.map((option) => {
      const hasChildren = Boolean(option.children?.length);
      const isLeaf = !hasChildren;
      const disabled = Boolean(option.disabled) || Boolean(field.leafOnly && !isLeaf);
      const expandKey = `${field.name}:${String(option.value)}`;
      const expanded = expandedTreeNodes[expandKey] ?? false;
      return (
        <Box key={expandKey}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box sx={{ width: depth * 16 }} />
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={() => toggleTreeNode(field.name, option.value)}
                sx={{ mr: 0.5 }}
              >
                {expanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
              </IconButton>
            ) : (
              <Box sx={{ width: 32 }} />
            )}
            <ListItemButton
              dense
              disabled={saving || field.disabledWhen?.(values) || disabled}
              onClick={() => {
                if (disabled) {
                  return;
                }
                applyFieldChange(field, option.value);
                setTreeSelectAnchor(null);
                setActiveTreeField(null);
              }}
              sx={{ borderRadius: 1, py: 0.5, px: 1 }}
            >
              <ListItemText
                primary={option.label}
                secondary={hasChildren && field.leafOnly ? t("common.treeSelect.groupOnly") : undefined}
              />
            </ListItemButton>
          </Box>
          {hasChildren && expanded ? renderTreeOptions(option.children || [], field, depth + 1) : null}
        </Box>
      );
    });

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

          if (field.type === "treeSelect") {
            const treeLabelMap = buildTreeLabelMap(field.treeOptions);
            const displayValue = values[field.name] === "" || values[field.name] == null
              ? ""
              : treeLabelMap.get(values[field.name]) || String(values[field.name]);
            return (
              <FormControl key={field.name} fullWidth>
                <TextField
                  label={field.label}
                  value={displayValue}
                  placeholder={field.placeholder || t("actions.notSelected")}
                  onClick={(event) => {
                    if (saving || field.disabledWhen?.(values)) {
                      return;
                    }
                    setTreeSelectAnchor(event.currentTarget);
                    setActiveTreeField(field);
                  }}
                  inputProps={{ readOnly: true }}
                  disabled={saving || field.disabledWhen?.(values)}
                  fullWidth
                />
                <Popover
                  open={activeTreeField?.name === field.name && Boolean(treeSelectAnchor)}
                  anchorEl={treeSelectAnchor}
                  onClose={() => {
                    setTreeSelectAnchor(null);
                    setActiveTreeField(null);
                  }}
                  anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                  transformOrigin={{ vertical: "top", horizontal: "left" }}
                  PaperProps={{ sx: { width: 420, maxWidth: "calc(100vw - 48px)", maxHeight: 360, p: 1 } }}
                >
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <Typography variant="subtitle2">{field.label}</Typography>
                    <List dense sx={{ p: 0 }}>
                      <ListItemButton
                        dense
                        onClick={() => {
                          applyFieldChange(field, "");
                          setTreeSelectAnchor(null);
                          setActiveTreeField(null);
                        }}
                        disabled={saving || field.disabledWhen?.(values)}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemText primary={t("actions.notSelected")} />
                      </ListItemButton>
                      {field.treeOptions?.length ? (
                        renderTreeOptions(field.treeOptions, field)
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
                          {t("common.loading")}
                        </Typography>
                      )}
                    </List>
                  </Box>
                </Popover>
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
              multiline={field.multiline}
              rows={field.multiline ? field.rows ?? 3 : undefined}
              placeholder={field.placeholder}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                {
                  if (field.type === "number") {
                    const rawValue = event.target.value;
                    if (rawValue === "") {
                      applyFieldChange(field, "");
                      return;
                    }
                    const parsed = Number(rawValue);
                    if (Number.isNaN(parsed)) {
                      return;
                    }
                    if (field.min !== undefined && parsed < field.min) {
                      return;
                    }
                    applyFieldChange(field, parsed);
                    return;
                  }
                  applyFieldChange(field, event.target.value);
                }
              }
              disabled={saving || field.disabledWhen?.(values)}
              inputProps={
                field.type === "number"
                  ? {
                      ...(field.min !== undefined ? { min: field.min } : {}),
                      ...(field.step !== undefined ? { step: field.step } : {})
                    }
                  : undefined
              }
              fullWidth
            />
          );
        })}
        {state.renderExtra ? <Box sx={{ mt: 2 }}>{state.renderExtra(values)}</Box> : null}
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



