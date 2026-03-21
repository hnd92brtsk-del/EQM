import type { CSSProperties } from "react";

import type { NodeType } from "./types";

type Props = {
  type: NodeType;
  className?: string;
  style?: CSSProperties;
};

function PathSet({ type }: { type: NodeType }) {
  switch (type) {
    case "router":
      return (
        <>
          <circle cx="16" cy="16" r="7.5" fill="none" />
          <path d="M16 8.5v15M8.5 16h15" />
        </>
      );
    case "core-switch":
    case "switch":
      return (
        <>
          <path d="M8.5 12 16 8.5 23.5 12 16 15.5 8.5 12Z" fill="none" />
          <path d="M8.5 16 16 19.5 23.5 16" />
          <path d="M8.5 20 16 23.5 23.5 20" />
        </>
      );
    case "firewall":
      return <path d="M16 8.5c3 2 5.8 2.6 8 2.8v4.8c0 4.6-3.2 7.8-8 9.4-4.8-1.6-8-4.8-8-9.4v-4.8c2.2-.2 5-0.8 8-2.8Z" fill="none" />;
    case "load-balancer":
      return (
        <>
          <path d="M10 10h12v4H10z" fill="none" />
          <path d="M10 18h12v4H10z" fill="none" />
          <path d="M16 10V6M16 26v-4" />
        </>
      );
    case "vpn-gateway":
      return (
        <>
          <rect x="10" y="14" width="12" height="9" rx="2" fill="none" />
          <path d="M12.5 14v-2.2a3.5 3.5 0 0 1 7 0V14" />
        </>
      );
    case "wireless-controller":
    case "access-point":
      return (
        <>
          <circle cx="16" cy="20.5" r="1" fill="currentColor" stroke="none" />
          <path d="M11 18a7 7 0 0 1 10 0" />
          <path d="M8.5 15a10.5 10.5 0 0 1 15 0" />
        </>
      );
    case "server":
    case "vm-host":
      return (
        <>
          <rect x="9.5" y="9" width="13" height="6.5" rx="1.5" fill="none" />
          <rect x="9.5" y="17.5" width="13" height="6.5" rx="1.5" fill="none" />
          <circle cx="12.5" cy="12.25" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="20.75" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "storage":
    case "nas":
      return (
        <>
          <ellipse cx="16" cy="10.5" rx="6.5" ry="2.8" fill="none" />
          <path d="M9.5 10.5V21c0 1.6 2.9 2.8 6.5 2.8s6.5-1.2 6.5-2.8V10.5" />
          <path d="M9.5 15c0 1.6 2.9 2.8 6.5 2.8s6.5-1.2 6.5-2.8" />
        </>
      );
    case "cloud":
      return <path d="M12.2 24c-3.2 0-5.7-2.3-5.7-5.2 0-2.8 2.2-5 5.1-5.2.8-3.2 3.8-5.6 7.3-5.6 4.2 0 7.6 3.3 7.6 7.4v.3c2.1.6 3.5 2.5 3.5 4.7 0 2.7-2.4 4.9-5.3 4.9H12.2Z" transform="translate(-2 -3)" fill="none" />;
    case "internet":
      return (
        <>
          <circle cx="16" cy="16" r="7.5" fill="none" />
          <path d="M16 8.5c2.2 2 3.5 4.6 3.5 7.5S18.2 21.5 16 23.5c-2.2-2-3.5-4.6-3.5-7.5S13.8 10.5 16 8.5Z" />
          <path d="M8.5 16h15" />
        </>
      );
    case "workstation":
      return (
        <>
          <rect x="8.5" y="9.5" width="15" height="10.5" rx="1.6" fill="none" />
          <path d="M13 23h6M16 20v3" />
        </>
      );
    case "printer":
      return (
        <>
          <rect x="10.5" y="8.5" width="11" height="5.5" rx="1.2" fill="none" />
          <rect x="8.5" y="14" width="15" height="7.5" rx="1.6" fill="none" />
          <path d="M11 21.5h10v3H11z" fill="none" />
        </>
      );
    case "camera":
      return (
        <>
          <rect x="9.5" y="12" width="10.5" height="7.5" rx="1.6" fill="none" />
          <path d="M20 14.5 24 12v7l-4-2.5" />
        </>
      );
    case "iot-gateway":
      return (
        <>
          <rect x="12" y="12" width="8" height="8" rx="1.5" fill="none" />
          <path d="M16 6.5v3M16 22.5v3M6.5 16h3M22.5 16h3M10.2 10.2l2 2M19.8 19.8l2 2M21.8 10.2l-2 2M12.2 19.8l-2 2" />
        </>
      );
    default:
      return <circle cx="16" cy="16" r="7.5" fill="none" />;
  }
}

export function NetworkDeviceIcon({ type, className, style }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <PathSet type={type} />
    </svg>
  );
}
