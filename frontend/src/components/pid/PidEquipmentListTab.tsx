import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useTranslation } from "react-i18next";

import type { PidNode } from "../../types/pid";

type Props = {
  nodes: PidNode[];
  onJumpToNode: (nodeId: string) => void;
};

export function PidEquipmentListTab({ nodes, onJumpToNode }: Props) {
  const { t } = useTranslation();
  return (
    <TableContainer sx={{ maxHeight: 560 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t("pid.list.type")}</TableCell>
            <TableCell>{t("pid.list.tag")}</TableCell>
            <TableCell>{t("pid.list.name")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {nodes.map((item) => (
            <TableRow key={item.id} hover onClick={() => onJumpToNode(item.id)} sx={{ cursor: "pointer" }}>
              <TableCell>{item.category === "instrument" ? t("pid.list.instrument") : t("pid.list.equipment")}</TableCell>
              <TableCell>{item.tag || "-"}</TableCell>
              <TableCell>{item.label || item.symbolKey}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
