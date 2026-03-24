import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  TextField,
  Typography,
  useTheme
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useTranslation } from "react-i18next";

import { annotateLiveTree, type LiveTreeAnnotation } from "../utils/liveFilter";

export type SearchableTreeSelectOption = {
  label: string;
  value: number | string;
  disabled?: boolean;
  children?: SearchableTreeSelectOption[];
};

type Props = {
  label?: string;
  value: number | string;
  options?: SearchableTreeSelectOption[];
  onChange: (value: number | string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
  noOptionsLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  leafOnly?: boolean;
  groupOnlyLabel?: string;
  loadingLabel?: string;
  hideEmptyOption?: boolean;
};

export function SearchableTreeSelectField({
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
  leafOnly = false,
  groupOnlyLabel,
  loadingLabel,
  hideEmptyOption = false
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const open = Boolean(anchorEl);

  const annotations = useMemo(
    () =>
      annotateLiveTree(
        options || [],
        {
          getLabel: (option) => option.label,
          getChildren: (option) => option.children
        },
        query
      ),
    [options, query]
  );

  const { labelMap, parentMap } = useMemo(() => {
    const nextLabelMap = new Map<number | string, string>();
    const nextParentMap = new Map<number | string, number | string | null>();

    const walk = (
      items: SearchableTreeSelectOption[],
      path: string[],
      parentValue: number | string | null
    ) => {
      items.forEach((item) => {
        const nextPath = [...path, item.label];
        nextLabelMap.set(item.value, nextPath.join(" / "));
        nextParentMap.set(item.value, parentValue);
        walk(item.children || [], nextPath, item.value);
      });
    };

    walk(options || [], [], null);

    return { labelMap: nextLabelMap, parentMap: nextParentMap };
  }, [options]);

  const normalizedQuery = query.trim();
  const resolvedEmptyLabel = emptyOptionLabel || t("actions.notSelected");
  const primaryTextColor = theme.palette.mode === "light" ? "#000000" : theme.palette.text.primary;
  const secondaryTextColor = theme.palette.mode === "light" ? "#334155" : theme.palette.text.secondary;
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

  useEffect(() => {
    if (!open || value === "" || value === null || value === undefined) {
      return;
    }

    setExpandedIds((prev) => {
      const next = new Set(prev);
      let parentValue = parentMap.get(value) ?? null;
      while (parentValue !== null && parentValue !== undefined) {
        next.add(String(parentValue));
        parentValue = parentMap.get(parentValue) ?? null;
      }
      return next;
    });
  }, [open, parentMap, value]);

  const toggleExpanded = (nodeValue: number | string) => {
    const key = String(nodeValue);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderNode = (node: LiveTreeAnnotation<SearchableTreeSelectOption>, depth: number): ReactNode => {
    const option = node.item;
    const hasVisibleChildren = node.children.length > 0;
    const hasNestedOptions = Boolean(option.children?.length);
    const isLeaf = !hasNestedOptions;
    const key = String(option.value);
    const expanded = normalizedQuery ? node.shouldForceExpand : expandedIds.has(key);
    const selected = value === option.value;
    const optionDisabled = Boolean(option.disabled) || Boolean(leafOnly && !isLeaf);

    return (
      <Box key={key}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box sx={{ width: depth * 16 }} />
          {hasVisibleChildren ? (
            <IconButton size="small" onClick={() => toggleExpanded(option.value)} sx={{ mr: 0.5 }}>
              {expanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
            </IconButton>
          ) : (
            <Box sx={{ width: 32 }} />
          )}
          <ListItemButton
            dense
            disabled={disabled || optionDisabled}
            selected={selected}
            onClick={() => {
              if (optionDisabled) {
                return;
              }
              onChange(option.value);
              setAnchorEl(null);
            }}
            sx={{
              borderRadius: 1,
              py: 0.5,
              px: 1,
              color: primaryTextColor
            }}
          >
            <ListItemText
              primary={option.label}
              primaryTypographyProps={{
                sx: {
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  color: primaryTextColor,
                }
              }}
              secondary={hasNestedOptions && leafOnly ? groupOnlyLabel || t("common.treeSelect.groupOnly") : undefined}
              secondaryTypographyProps={{ sx: { color: secondaryTextColor } }}
            />
          </ListItemButton>
        </Box>
        {hasVisibleChildren && expanded ? (
          <Box sx={{ display: "grid", gap: 0.25 }}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </Box>
        ) : null}
      </Box>
    );
  };

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
            width: anchorEl ? anchorEl.clientWidth : 560,
            maxWidth: "min(560px, calc(100vw - 32px))",
            maxHeight: 420,
            p: 1,
            borderRadius: 2
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
          <List dense sx={{ p: 0, maxHeight: 320, overflowY: "auto" }}>
            {!hideEmptyOption ? (
              <ListItemButton
                dense
                selected={value === "" || value === null || value === undefined}
                onClick={() => {
                  onChange("");
                  setAnchorEl(null);
                }}
                disabled={disabled}
                sx={{ borderRadius: 1, mb: 0.5, color: primaryTextColor }}
              >
                <ListItemText primary={resolvedEmptyLabel} primaryTypographyProps={{ sx: { color: primaryTextColor } }} />
              </ListItemButton>
            ) : null}
            {options == null ? (
              <Typography variant="body2" sx={{ px: 1, py: 0.5, color: secondaryTextColor }}>
                {loadingLabel || t("common.loading")}
              </Typography>
            ) : annotations.length ? (
              annotations.map((node) => renderNode(node, 0))
            ) : (
              <Typography variant="body2" sx={{ px: 1, py: 0.5, color: secondaryTextColor }}>
                {noOptionsLabel || t("common.liveFilter.noOptions")}
              </Typography>
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}
