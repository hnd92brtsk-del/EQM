import { Box, Paper, Typography } from "@mui/material";
import { useEffect, useRef, useState, type RefObject } from "react";

export type FloatingRect = { x: number; y: number; width: number; height: number };

type Props = {
  id: string;
  title: string;
  rect: FloatingRect;
  boundsRef: RefObject<HTMLDivElement>;
  zIndex: number;
  onFocus: () => void;
  onRectChange: (next: FloatingRect) => void;
  children: React.ReactNode;
};

const MIN_W = 220;
const MIN_H = 180;

export function PidFloatingPanel({ id, title, rect, boundsRef, zIndex, onFocus, onRectChange, children }: Props) {
  const [draft, setDraft] = useState<FloatingRect>(rect);
  const draftRef = useRef<FloatingRect>(rect);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    setDraft(rect);
    draftRef.current = rect;
  }, [rect]);

  const getBoundsSize = () => {
    const bounds = boundsRef.current?.getBoundingClientRect();
    return {
      width: bounds?.width ?? window.innerWidth,
      height: bounds?.height ?? window.innerHeight,
    };
  };

  const clamp = (next: FloatingRect): FloatingRect => {
    const maxRect = getBoundsSize();
    const width = Math.max(MIN_W, Math.min(next.width, maxRect.width));
    const height = Math.max(MIN_H, Math.min(next.height, maxRect.height));
    const x = Math.max(0, Math.min(next.x, Math.max(0, maxRect.width - width)));
    const y = Math.max(0, Math.min(next.y, Math.max(0, maxRect.height - height)));
    return { x, y, width, height };
  };

  const onHeaderMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;
    onFocus();
    const bounds = boundsRef.current?.getBoundingClientRect();
    const boundsLeft = bounds?.left ?? 0;
    const boundsTop = bounds?.top ?? 0;
    dragRef.current = {
      dx: event.clientX - (boundsLeft + draftRef.current.x),
      dy: event.clientY - (boundsTop + draftRef.current.y),
    };
    const onMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const nextBounds = boundsRef.current?.getBoundingClientRect();
      const nextBoundsLeft = nextBounds?.left ?? 0;
      const nextBoundsTop = nextBounds?.top ?? 0;
      const next = clamp({
        ...draftRef.current,
        x: moveEvent.clientX - nextBoundsLeft - dragRef.current.dx,
        y: moveEvent.clientY - nextBoundsTop - dragRef.current.dy,
      });
      setDraft(next);
      draftRef.current = next;
    };
    const onUp = () => {
      dragRef.current = null;
      onRectChange(clamp(draftRef.current));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;
    onFocus();
    resizeRef.current = { startX: event.clientX, startY: event.clientY, startW: draft.width, startH: draft.height };
    const onMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const deltaX = moveEvent.clientX - resizeRef.current.startX;
      const deltaY = moveEvent.clientY - resizeRef.current.startY;
      const next = clamp({
        ...draftRef.current,
        width: resizeRef.current.startW + deltaX,
        height: resizeRef.current.startH + deltaY,
      });
      setDraft(next);
      draftRef.current = next;
    };
    const onUp = () => {
      resizeRef.current = null;
      onRectChange(clamp(draftRef.current));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <Paper
      id={id}
      elevation={6}
      onMouseDown={onFocus}
      sx={{
        position: "absolute",
        left: draft.x,
        top: draft.y,
        width: draft.width,
        height: draft.height,
        zIndex,
        display: "grid",
        gridTemplateRows: "36px 1fr",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        onMouseDown={onHeaderMouseDown}
        sx={{
          px: 1.25,
          display: "flex",
          alignItems: "center",
          cursor: "move",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.default",
        }}
      >
        <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ minHeight: 0, overflow: "auto", bgcolor: "background.paper" }}>{children}</Box>
      <Box
        onMouseDown={onResizeMouseDown}
        sx={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 14,
          height: 14,
          cursor: "nwse-resize",
          bgcolor: "transparent",
        }}
      />
    </Paper>
  );
}
