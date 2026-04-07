import { forwardRef } from "react";
import { Button, type ButtonProps } from "@mui/material";

export const AppButton = forwardRef<HTMLButtonElement, ButtonProps>(function AppButton(
  { color = "primary", variant = "outlined", size = "medium", sx, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      color={color}
      variant={variant}
      size={size}
      sx={[
        {
          minHeight: size === "small" ? 34 : 42,
          px: size === "small" ? 1.5 : 2.25,
          borderRadius: 0,
          fontWeight: 700,
          letterSpacing: "0.01em"
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...props}
    />
  );
});



