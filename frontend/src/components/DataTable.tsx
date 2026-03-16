import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  type SxProps,
  type Theme
} from "@mui/material";

type ColumnMeta = {
  headerSx?: SxProps<Theme>;
  cellSx?: SxProps<Theme>;
};

export function DataTable<T>({
  data,
  columns,
  tableSx
}: {
  data: T[];
  columns: ColumnDef<T>[];
  tableSx?: SxProps<Theme>;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

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
