import { SvgIcon, SvgIconProps } from "@mui/material";

export function WarehouseIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d="M3 9l9-5 9 5v10a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2V9zm6 1h2v2H9v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
