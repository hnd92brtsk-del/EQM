import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  TextField,
  type SxProps,
  type Theme
} from "@mui/material";
import { useMemo, useState } from "react";
import { SearchableSelectField } from "./SearchableSelectField";

export type DataTableFilterType = "text" | "select" | "number" | "date" | "boolean";

export type DataTableFilterOption = {
  label: string;
  value: string | number;
};

export type DataTableFiltersState = Record<string, string>;

export type ColumnMeta<TData = unknown> = {
  headerSx?: SxProps<Theme>;
  cellSx?: SxProps<Theme>;
  filterType?: DataTableFilterType;
  filterKey?: string;
  filterOptions?: DataTableFilterOption[];
  filterPlaceholder?: string;
  filterDisabled?: boolean;
  filterWidth?: number | string;
  alphabetFilterKey?: string;
  filterAccessor?: (row: TData) => unknown;
};

const EN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const RU_ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя";

const matchesAlphabet = (value: unknown, alphabet: string) => {
  if (!alphabet) {
    return true;
  }
  const text = String(value ?? "").trim();
  if (!text) {
    return false;
  }
  const firstChar = text[0];
  if (alphabet === "ru") {
    return RU_ALPHABET.includes(firstChar);
  }
  if (alphabet === "en") {
    return EN_ALPHABET.includes(firstChar);
  }
  return true;
};

export function DataTable<T>({
  data,
  columns,
  tableSx,
  columnFilters,
  onColumnFiltersChange,
  showColumnFilters = false
}: {
  data: T[];
  columns: ColumnDef<T>[];
  tableSx?: SxProps<Theme>;
  columnFilters?: DataTableFiltersState;
  onColumnFiltersChange?: (nextFilters: DataTableFiltersState) => void;
  showColumnFilters?: boolean;
}) {
  const [internalFilters, setInternalFilters] = useState<DataTableFiltersState>({});
  const activeFilters = columnFilters ?? internalFilters;
  const hasExternalFilters = Boolean(onColumnFiltersChange);

  const handleFilterChange = (key: string, value: string) => {
    const nextFilters = { ...activeFilters };
    if (!value) {
      delete nextFilters[key];
    } else {
      nextFilters[key] = value;
    }

    if (onColumnFiltersChange) {
      onColumnFiltersChange(nextFilters);
      return;
    }
    setInternalFilters(nextFilters);
  };

  const preparedData = useMemo(() => {
    if (hasExternalFilters || !showColumnFilters) {
      return data;
    }

    return data.filter((row) =>
      columns.every((column) => {
        const meta = (column.meta as ColumnMeta<T> | undefined) || undefined;
        if (!meta?.filterType) {
          return true;
        }

        const filterKey = meta.filterKey;
        const alphabetFilterKey = meta.alphabetFilterKey;
        const accessorKey =
          "accessorKey" in column && typeof column.accessorKey === "string" ? column.accessorKey : undefined;
        const rawValue = meta.filterAccessor
          ? meta.filterAccessor(row)
          : accessorKey
            ? (row as Record<string, unknown>)[accessorKey]
            : undefined;

        if (filterKey) {
          const filterValue = activeFilters[filterKey] ?? "";
          if (filterValue) {
            const normalizedValue = String(rawValue ?? "").toLowerCase();
            const normalizedFilter = filterValue.toLowerCase();

            if (meta.filterType === "select" || meta.filterType === "boolean") {
              if (String(rawValue ?? "") !== filterValue) {
                return false;
              }
            } else if (!normalizedValue.includes(normalizedFilter)) {
              return false;
            }
          }
        }

        if (alphabetFilterKey) {
          const alphabetValue = activeFilters[alphabetFilterKey] ?? "";
          if (alphabetValue && !matchesAlphabet(rawValue, alphabetValue)) {
            return false;
          }
        }

        return true;
      })
    );
  }, [activeFilters, columns, data, hasExternalFilters, showColumnFilters]);

  const table = useReactTable({
    data: preparedData,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const filterableHeaders = showColumnFilters
    ? table
        .getHeaderGroups()
        .flatMap((headerGroup) => headerGroup.headers)
        .filter((header) => {
          const meta = (header.column.columnDef.meta as ColumnMeta<T> | undefined) || undefined;
          return Boolean(meta?.filterType || meta?.alphabetFilterKey);
        })
    : [];

  const renderFilterField = (meta: ColumnMeta<T> | undefined) => {
    if (!meta) {
      return null;
    }

    const filterKey = meta.filterKey;
    const alphabetFilterKey = meta.alphabetFilterKey;
    const width = meta.filterWidth ?? "100%";

    return (
      <Box sx={{ display: "grid", gap: 0.75, minWidth: width }}>
        {filterKey && meta.filterType === "text" ? (
          <TextField
            size="small"
            variant="outlined"
            value={activeFilters[filterKey] ?? ""}
            onChange={(event) => handleFilterChange(filterKey, event.target.value)}
            placeholder={meta.filterPlaceholder}
            disabled={meta.filterDisabled}
            fullWidth
          />
        ) : null}

        {filterKey && meta.filterType === "number" ? (
          <TextField
            size="small"
            variant="outlined"
            type="number"
            value={activeFilters[filterKey] ?? ""}
            onChange={(event) => handleFilterChange(filterKey, event.target.value)}
            placeholder={meta.filterPlaceholder}
            disabled={meta.filterDisabled}
            fullWidth
          />
        ) : null}

        {filterKey && meta.filterType === "date" ? (
          <TextField
            size="small"
            variant="outlined"
            type="date"
            value={activeFilters[filterKey] ?? ""}
            onChange={(event) => handleFilterChange(filterKey, event.target.value)}
            disabled={meta.filterDisabled}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        ) : null}

        {filterKey && meta.filterType === "select" ? (
          <SearchableSelectField
            value={activeFilters[filterKey] ?? ""}
            options={(meta.filterOptions || []).map((option) => ({
              value: String(option.value),
              label: option.label
            }))}
            onChange={(value) => handleFilterChange(filterKey, String(value))}
            placeholder={meta.filterPlaceholder || "All"}
            emptyOptionLabel={meta.filterPlaceholder || "All"}
            noOptionsLabel={meta.filterPlaceholder || "All"}
            disabled={meta.filterDisabled}
            size="small"
            hideEmptyOption={false}
            fullWidth
          />
        ) : null}

        {filterKey && meta.filterType === "boolean" ? (
          <SearchableSelectField
            value={activeFilters[filterKey] ?? ""}
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" }
            ]}
            onChange={(value) => handleFilterChange(filterKey, String(value))}
            placeholder={meta.filterPlaceholder || "All"}
            emptyOptionLabel={meta.filterPlaceholder || "All"}
            noOptionsLabel={meta.filterPlaceholder || "All"}
            disabled={meta.filterDisabled}
            size="small"
            fullWidth
          />
        ) : null}

        {alphabetFilterKey ? (
          <SearchableSelectField
            value={activeFilters[alphabetFilterKey] ?? ""}
            options={[
              { value: "ru", label: "RU" },
              { value: "en", label: "EN" }
            ]}
            onChange={(value) => handleFilterChange(alphabetFilterKey, String(value))}
            placeholder="All"
            emptyOptionLabel="All"
            noOptionsLabel="All"
            disabled={meta.filterDisabled}
            size="small"
            fullWidth
          />
        ) : null}
      </Box>
    );
  };

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small" sx={tableSx}>
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = (header.column.columnDef.meta as ColumnMeta | undefined) || undefined;
                return (
                  <TableCell
                    key={header.id}
                    sx={{
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      verticalAlign: "top",
                      ...meta?.headerSx
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {showColumnFilters && filterableHeaders.length > 0 ? (
            <TableRow>
              {table.getFlatHeaders().map((header) => {
                const meta = (header.column.columnDef.meta as ColumnMeta<T> | undefined) || undefined;
                return (
                  <TableCell
                    key={`${header.id}-filters`}
                    sx={{
                      verticalAlign: "top",
                      py: 1,
                      ...meta?.headerSx
                    }}
                  >
                    {header.isPlaceholder ? null : renderFilterField(meta)}
                  </TableCell>
                );
              })}
            </TableRow>
          ) : null}
        </TableHead>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const meta = (cell.column.columnDef.meta as ColumnMeta | undefined) || undefined;
                return (
                  <TableCell
                    key={cell.id}
                    sx={{
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      verticalAlign: "top",
                      ...meta?.cellSx
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
