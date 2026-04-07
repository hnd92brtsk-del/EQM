import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  InputAdornment,
  MenuItem,
  MenuList,
  Popover,
  TextField,
  Typography
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useTranslation } from "react-i18next";

import { annotateLiveFlatOptions } from "../utils/liveFilter";

export type SearchableSelectOption = {
  label: string;
  value: number | string;
  disabled?: boolean;
};

type Props = {
  label?: string;
  value: number | string;
  options: SearchableSelectOption[];
  onChange: (value: number | string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  noOptionsLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  hideEmptyOption?: boolean;
};

export function SearchableSelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  emptyOptionLabel,
  noOptionsLabel,
  disabled = false,
  fullWidth = true,
  size = "medium",
  hideEmptyOption = false
}: Props) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const open = Boolean(anchorEl);

  const annotations = useMemo(
    () => annotateLiveFlatOptions(options, (option) => option.label, query),
    [options, query]
  );

  const labelMap = useMemo(() => {
    const map = new Map<number | string, string>();
    options.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [options]);

  const resolvedEmptyLabel = emptyOptionLabel || t("actions.notSelected");
  const displayValue =
    value === "" || value === null || value === undefined
      ? ""
      : labelMap.get(value) || String(value);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <>
      <TextField
        label={label}
        value={displayValue}
        placeholder={placeholder || resolvedEmptyLabel}
        onClick={(event) => {
          if (!disabled) {
            setAnchorEl(event.currentTarget);
          }
        }}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            setAnchorEl(event.currentTarget as HTMLElement);
          }
        }}
        inputProps={{ readOnly: true }}
        disabled={disabled}
        fullWidth={fullWidth}
        size={size}
        sx={{
          "& .MuiOutlinedInput-input": {
            cursor: disabled ? "not-allowed" : "pointer"
          }
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            width: anchorEl ? anchorEl.clientWidth : 320,
            maxWidth: "min(560px, calc(100vw - 32px))",
            maxHeight: 420,
            p: 1,
            borderRadius: 0
          }
        }}
      >
        <Box sx={{ display: "grid", gap: 1 }}>
          <TextField
            inputRef={searchInputRef}
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("common.liveFilter.searchPlaceholder")}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" color="action" />
                </InputAdornment>
              )
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setAnchorEl(null);
              }
            }}
          />
          <MenuList dense autoFocusItem={false} sx={{ p: 0, maxHeight: 320, overflowY: "auto" }}>
            {!hideEmptyOption ? (
              <MenuItem
                selected={value === "" || value === null || value === undefined}
                onClick={() => {
                  onChange("");
                  setAnchorEl(null);
                }}
                sx={{ borderRadius: 0, mb: 0.5 }}
              >
                {resolvedEmptyLabel}
              </MenuItem>
            ) : null}
            {annotations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
                {noOptionsLabel || t("common.liveFilter.noOptions")}
              </Typography>
            ) : (
              annotations.map(({ item, label: optionLabel }) => {
                const selected = value === item.value;

                return (
                  <MenuItem
                    key={String(item.value)}
                    selected={selected}
                    disabled={item.disabled}
                    onClick={() => {
                      onChange(item.value);
                      setAnchorEl(null);
                    }}
                    sx={{
                      borderRadius: 0,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word"
                    }}
                  >
                    {optionLabel}
                  </MenuItem>
                );
              })
            )}
          </MenuList>
        </Box>
      </Popover>
    </>
  );
}
