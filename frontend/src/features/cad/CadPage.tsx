import { Alert, Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { PixiCadRenderer } from "../../cad/renderer/pixi/PixiCadRenderer";
import { getCadDocument } from "./api/cad";

export default function CadPage() {
  const { documentId = "" } = useParams();
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState<string>();
  const [state, setState] = useState<"loading" | "ready" | "notFound" | "error" | "webgl">("loading");

  useEffect(() => {
    let renderer: PixiCadRenderer | null = null;
    let active = true;
    (async () => {
      try {
        const record = await getCadDocument(documentId);
        if (!active || !hostRef.current) return;
        setTitle(record.name);
        renderer = new PixiCadRenderer();
        await renderer.mount(hostRef.current);
        if (!active) {
          renderer.unmount();
          return;
        }
        setState("ready");
      } catch (error) {
        if (!active) return;
        const status = (error as { status?: number }).status;
        setState(status === 404 ? "notFound" : "error");
      }
    })();
    return () => { active = false; renderer?.unmount(); };
  }, [documentId]);

  if (state === "notFound") return <Alert severity="info">{t("pages.cad.notFound")}</Alert>;
  if (state === "error" || state === "webgl") return <Alert severity="error">{t("pages.cad.rendererError")}</Alert>;
  return <Stack spacing={2} sx={{ minHeight: "calc(100vh - 150px)" }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h4">{title}</Typography><Typography color="text.secondary">{t("pages.cad.foundation")}</Typography></Box><Chip label={t("pages.cad.savedPlaceholder")} /></Stack>
    <Paper variant="outlined" sx={{ flex: 1, minHeight: 440, overflow: "hidden", position: "relative" }}>
      <Box ref={hostRef} sx={{ width: "100%", height: "100%", minHeight: 440 }} />
      {state === "loading" ? <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : null}
    </Paper>
  </Stack>;
}
