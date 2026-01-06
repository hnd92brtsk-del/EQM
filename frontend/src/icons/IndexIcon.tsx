import { SvgIcon, SvgIconProps } from "@mui/material";

export function IndexIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d="M4 4h16v2H4V4zm0 5h10v2H4V9zm0 5h16v2H4v-2zm0 5h10v2H4v-2z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
