import { SvgIcon, SvgIconProps } from "@mui/material";

export function CabinetIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm1 4v10h12V7H6zm5 2h2v2h-2V9zm0 4h2v2h-2v-2z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
