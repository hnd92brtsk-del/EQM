import { Box, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import type { PidEdge, PidNode } from "../../types/pid";

type Props = {
  selectedNode: PidNode | null;
  selectedEdge: PidEdge | null;
  readOnly: boolean;
  title?: string;
  bordered?: boolean;
  onNodeChange: (next: PidNode) => void;
  onEdgeChange: (next: PidEdge) => void;
};

export function PidPropertiesPanel({
  selectedNode,
  selectedEdge,
  readOnly,
  title,
  bordered = true,
  onNodeChange,
  onEdgeChange,
}: Props) {
  const { t } = useTranslation();

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
      {selectedNode ? (
        <>
          <TextField
            label={t("pid.properties.tag")}
            size="small"
            value={selectedNode.tag}
            disabled={readOnly}
            onChange={(e) => onNodeChange({ ...selectedNode, tag: e.target.value })}
          />
          <TextField
            label={t("pid.properties.label")}
            size="small"
            value={selectedNode.label}
            disabled={readOnly}
            onChange={(e) => onNodeChange({ ...selectedNode, label: e.target.value })}
          />
          <TextField
            label={t("pid.properties.plc")}
            size="small"
            value={selectedNode.properties.plc || ""}
            disabled={readOnly}
            onChange={(e) =>
              onNodeChange({ ...selectedNode, properties: { ...selectedNode.properties, plc: e.target.value } })
            }
          />
          <TextField
            label={t("pid.properties.ranges")}
            size="small"
            value={selectedNode.properties.ranges || ""}
            disabled={readOnly}
            onChange={(e) =>
              onNodeChange({ ...selectedNode, properties: { ...selectedNode.properties, ranges: e.target.value } })
            }
          />
          <TextField
            label={t("pid.properties.signalType")}
            size="small"
            value={selectedNode.properties.signalType || ""}
            disabled={readOnly}
            onChange={(e) =>
              onNodeChange({
                ...selectedNode,
                properties: { ...selectedNode.properties, signalType: e.target.value },
              })
            }
          />
          <TextField
            label={t("pid.properties.params")}
            size="small"
            multiline
            minRows={2}
            value={selectedNode.properties.params || ""}
            disabled={readOnly}
            onChange={(e) =>
              onNodeChange({ ...selectedNode, properties: { ...selectedNode.properties, params: e.target.value } })
            }
          />
        </>
      ) : null}

      {selectedEdge ? (
        <>
          <TextField
            label={t("pid.properties.edgeLabel")}
            size="small"
            value={selectedEdge.label}
            disabled={readOnly}
            onChange={(e) => onEdgeChange({ ...selectedEdge, label: e.target.value })}
          />
          <TextField label={t("pid.properties.edgeType")} size="small" value={t(`pid.edges.${selectedEdge.edgeType}`)} disabled />
        </>
      ) : null}
    </Box>
  );
}
