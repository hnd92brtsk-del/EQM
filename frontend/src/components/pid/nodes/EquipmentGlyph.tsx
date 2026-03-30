import { useEffect, useState } from "react";
import { Box } from "@mui/material";

import { getApiUrl } from "../../../api/client";
import { normalizePidSymbol } from "../../../features/pid/symbols";
import { getEquipmentSymbolSpec } from "../../../features/pid/equipmentSymbolRegistry";
import type { PidSymbol } from "../../../types/pid";

type Props = {
  shapeKey?: string;
  symbol?: PidSymbol | null;
  width?: number;
  height?: number;
  stroke?: string;
  selected?: boolean;
};

function EquipmentGlyphSvg({
  shapeKey,
  width,
  height,
  stroke,
  selected,
}: {
  shapeKey: string;
  width: number;
  height: number;
  stroke: string;
  selected: boolean;
}) {
  const spec = getEquipmentSymbolSpec(shapeKey);
  return <>{spec.render({ width, height, stroke, selected })}</>;
}

export function EquipmentGlyph({
  shapeKey,
  symbol,
  width = 64,
  height = 44,
  stroke = "#32475b",
  selected = false,
}: Props) {
  const [hasImageError, setHasImageError] = useState(false);
  const normalizedSymbol = normalizePidSymbol(
    symbol ? { pidSymbol: symbol, shapeKey: symbol.libraryKey || shapeKey } : { shapeKey },
    shapeKey || "generic"
  );
  const imageSrc =
    normalizedSymbol.assetUrl && /^(blob:|data:|https?:)/.test(normalizedSymbol.assetUrl)
      ? normalizedSymbol.assetUrl
      : normalizedSymbol.assetUrl
        ? getApiUrl(normalizedSymbol.assetUrl)
        : null;

  useEffect(() => {
    setHasImageError(false);
  }, [normalizedSymbol.assetUrl, normalizedSymbol.libraryKey, normalizedSymbol.source]);

  if (normalizedSymbol.source === "upload" && imageSrc && !hasImageError) {
    return (
      <Box
        sx={{
          width,
          height,
          display: "grid",
          placeItems: "center",
          borderRadius: "12px",
          outline: selected ? `2px solid ${stroke}` : "none",
          outlineOffset: "4px",
        }}
      >
        <Box
          component="img"
          src={imageSrc}
          alt=""
          aria-hidden
          onError={() => setHasImageError(true)}
          sx={{
            width,
            height,
            display: "block",
            objectFit: "contain",
          }}
        />
      </Box>
    );
  }

  return (
    <EquipmentGlyphSvg
      shapeKey={normalizedSymbol.libraryKey || shapeKey || "generic"}
      width={width}
      height={height}
      stroke={stroke}
      selected={selected}
    />
  );
}
