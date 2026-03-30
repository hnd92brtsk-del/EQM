import { Box, Button, Divider, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { SearchableSelectField, type SearchableSelectOption } from "../SearchableSelectField";
import type { PidEdge, PidNode } from "../../types/pid";

type Props = {
  selectedNode: PidNode | null;
  selectedEdge: PidEdge | null;
  readOnly: boolean;
  title?: string;
  bordered?: boolean;
  plcOptions?: SearchableSelectOption[];
  resolveNodeLabel?: (nodeId: string) => string;
  onNodeChange: (next: PidNode) => void;
  onEdgeChange: (next: PidEdge) => void;
  onDeleteEdge?: (edgeId: string) => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", gap: 1.5, py: 1.1, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.primary", textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

export function PidPropertiesPanel({
  selectedNode,
  selectedEdge,
  readOnly,
  title,
  bordered = true,
  plcOptions = [],
  resolveNodeLabel,
  onNodeChange,
  onDeleteEdge,
}: Props) {
  const { t } = useTranslation();

  const plcValue =
    typeof selectedNode?.properties.meta?.plcEquipmentInOperationId === "number"
      ? selectedNode.properties.meta.plcEquipmentInOperationId
      : selectedNode?.properties.plc || "";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        borderLeft: bordered ? "1px solid rgba(15,23,42,0.12)" : "none",
        p: 1.5,
        display: "grid",
        gap: 1.5,
        alignContent: "start",
        overflowY: "auto",
      }}
    >
      <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>
        {title || t("pid.properties.title")}
      </Typography>

      {!selectedNode && !selectedEdge ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("pid.properties.empty")}
        </Typography>
      ) : null}

      {selectedNode ? (
        <>
          <TextField
            label={t("pid.properties.tag")}
            size="small"
            value={selectedNode.tag}
            disabled={readOnly}
            onChange={(event) => onNodeChange({ ...selectedNode, tag: event.target.value })}
          />
          <TextField
            label={t("pid.properties.label")}
            size="small"
            value={selectedNode.label}
            disabled={readOnly}
            onChange={(event) => onNodeChange({ ...selectedNode, label: event.target.value })}
          />
          {selectedNode.category === "instrument" ? (
            <SearchableSelectField
              label={t("pid.properties.plc")}
              size="small"
              value={plcValue}
              options={plcOptions}
              onChange={(value) => {
                const selectedOption = plcOptions.find((item) => String(item.value) === String(value));
                const nextMeta = {
                  ...(selectedNode.properties.meta || {}),
                  plcEquipmentInOperationId: typeof selectedOption?.value === "number" ? selectedOption.value : null,
                };

                onNodeChange({
                  ...selectedNode,
                  properties: {
                    ...selectedNode.properties,
                    plc: value === "" ? undefined : selectedOption?.label || String(value),
                    meta: nextMeta,
                  },
                });
              }}
              disabled={readOnly}
              emptyOptionLabel={t("actions.notSelected")}
            />
          ) : null}
          <TextField
            label={t("pid.properties.params")}
            size="small"
            multiline
            minRows={3}
            value={selectedNode.properties.params || ""}
            disabled={readOnly}
            onChange={(event) =>
              onNodeChange({
                ...selectedNode,
                properties: { ...selectedNode.properties, params: event.target.value || undefined },
              })
            }
          />
        </>
      ) : null}

      {selectedEdge ? (
        <>
          <Divider />
          <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
            {t("pid.properties.edgeSection")}
          </Typography>
          <Row label={t("pid.properties.edgeType")} value={t(`pid.edges.${selectedEdge.edgeType}`)} />
          <Row label={t("pid.properties.edgeFrom")} value={resolveNodeLabel?.(selectedEdge.source) || selectedEdge.source} />
          <Row label={t("pid.properties.edgeTo")} value={resolveNodeLabel?.(selectedEdge.target) || selectedEdge.target} />
          {!readOnly ? (
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                onDeleteEdge?.(selectedEdge.id);
              }}
              sx={{ justifySelf: "start", mt: 1 }}
            >
              {t("pid.properties.deleteEdge")}
            </Button>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
