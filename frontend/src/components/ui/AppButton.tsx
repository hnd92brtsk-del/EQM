import { forwardRef } from "react";
import { Button, type ButtonProps } from "@mui/material";

export const AppButton = forwardRef<HTMLButtonElement, ButtonProps>(function AppButton(
  { color = "primary", variant = "text", ...props },
  ref
) {
  return <Button ref={ref} color={color} variant={variant} {...props} />;
});



