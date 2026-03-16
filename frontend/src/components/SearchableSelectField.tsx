import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  MenuItem,
  MenuList,
  Popover,
  TextField,
  Typography
} from "@mui/material";
import { useTranslation } from "react-i18next";

import {
  LIVE_FILTER_DIM_OPACITY,
  annotateLiveFlatOptions
} from "../utils/liveFilter";

export type SearchableSelectOption = {
  label: string;
  value: number | string;
  disabled?: boolean;
};

type Props = {
  label: string;
  value: number | string;
  options: SearchableSelectOption[];
  onChange: (value: number | string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
};

export function SearchableSelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  emptyOptionLabel,
  disabled = false,
  fullWidth = true,
  size = "medium"
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
            p: 1
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
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setAnchorEl(null);
              }
            }}
          />
          <MenuList dense autoFocusItem={false} sx={{ p: 0, maxHeight: 320, overflowY: "auto" }}>
            <MenuItem
              selected={value === "" || value === null || value === undefined}
              onClick={() => {
                onChange("");
                setAnchorEl(null);
              }}
            >
              {resolvedEmptyLabel}
            </MenuItem>
            {annotations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
                {t("common.liveFilter.noOptions")}
              </Typography>
            ) : (
              annotations.map(({ item, label: optionLabel, isDimmed }) => {
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
                      opacity: selected ? 1 : isDimmed ? LIVE_FILTER_DIM_OPACITY : 1,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      "&:hover": { opacity: 1 },
                      "&.Mui-focusVisible": { opacity: 1 },
                      "&.Mui-selected": { opacity: 1 }
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
