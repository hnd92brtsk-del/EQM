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
          <path d="M11.2 20.8h9.6" />
          <path d="M16 10.1v3.1" />
          <path d="M12.9 12.4a4.7 4.7 0 0 1 6.2 0" />
          <path d="M10.6 15a8 8 0 0 1 10.8 0" />
          <rect x="10.2" y="18.1" width="11.6" height="5.2" rx="1.8" fill="none" />
          <path d="M13.2 20.7h.01M16 20.7h.01M18.8 20.7h.01" />
        </>
      );
    case "core-switch":
      return (
        <>
          <path d="M8.8 12 16 8.8 23.2 12 16 15.2 8.8 12Z" fill="none" />
          <path d="M8.8 15.7 16 18.9 23.2 15.7" />
          <path d="M8.8 19.2 16 22.4 23.2 19.2" />
          <path d="M12.2 13.6h7.6" />
        </>
      );
    case "switch":
      return (
        <>
          <rect x="14.2" y="14.2" width="3.6" height="3.6" rx="0.9" fill="none" />
          <rect x="9.2" y="9.2" width="4.4" height="4.4" rx="1.1" fill="none" />
          <rect x="18.4" y="9.2" width="4.4" height="4.4" rx="1.1" fill="none" />
          <rect x="9.2" y="18.4" width="4.4" height="4.4" rx="1.1" fill="none" />
          <rect x="18.4" y="18.4" width="4.4" height="4.4" rx="1.1" fill="none" />
          <path d="M13.6 11.4h4.8M11.4 13.6v4.8M20.6 13.6v4.8M13.6 20.6h4.8" />
        </>
      );
    case "firewall":
      return (
        <>
          <path d="M16 8.5c3 2 5.8 2.6 8 2.8v4.8c0 4.6-3.2 7.8-8 9.4-4.8-1.6-8-4.8-8-9.4v-4.8c2.2-.2 5-0.8 8-2.8Z" fill="none" />
          <path d="M16 11.8v8" />
          <path d="M13.5 15.1 16 12.6l2.5 2.5" />
        </>
      );
    case "load-balancer":
      return (
        <>
          <path d="M16 7v4M16 21v4M10.5 12.2h11M10.5 19.8h11" />
          <path d="M12 12.2c0 2.2 1.8 4 4 4s4 1.8 4 3.6" />
          <path d="M20 12.2c0 2.2-1.8 4-4 4s-4 1.8-4 3.6" />
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
      return (
        <>
          <circle cx="16" cy="20.4" r="1" fill="currentColor" stroke="none" />
          <path d="M12 18.3a6.1 6.1 0 0 1 8 0" />
          <path d="M9.1 15.7a10 10 0 0 1 13.8 0" />
          <path d="M13.2 22.8h5.6" />
          <path d="M14.7 24.6h2.6" />
        </>
      );
    case "access-point":
      return (
        <>
          <circle cx="16" cy="20.8" r="1" fill="currentColor" stroke="none" />
          <path d="M12.6 18.6a5.2 5.2 0 0 1 6.8 0" />
          <path d="M10 15.9a8.8 8.8 0 0 1 12 0" />
          <path d="M14.9 22.7h2.2" />
        </>
      );
    case "server":
      return (
        <>
          <rect x="9.1" y="9.4" width="13.8" height="5.7" rx="1.5" fill="none" />
          <rect x="9.1" y="16.9" width="13.8" height="5.7" rx="1.5" fill="none" />
          <path d="M11.9 12.2h.01M14.8 12.2h5.9M11.9 19.7h.01M14.8 19.7h5.9" />
        </>
      );
    case "vm-host":
      return (
        <>
          <rect x="8.9" y="10.2" width="14.2" height="11.6" rx="2.1" fill="none" />
          <path d="M11.6 14.3h8.8M11.6 17.7h4.6" />
          <path d="M13.1 8v2.2M18.9 8v2.2" />
        </>
      );
    case "storage":
      return (
        <>
          <ellipse cx="16" cy="10.4" rx="6.3" ry="2.7" fill="none" />
          <path d="M9.7 10.4v10.8c0 1.6 2.8 2.8 6.3 2.8s6.3-1.2 6.3-2.8V10.4" />
          <path d="M9.7 15.1c0 1.5 2.8 2.7 6.3 2.7s6.3-1.2 6.3-2.7" />
        </>
      );
    case "nas":
      return (
        <>
          <rect x="10" y="9.5" width="12" height="13" rx="2" fill="none" />
          <path d="M12.8 13h6.4M12.8 16h6.4M12.8 19h6.4" />
          <path d="M11.8 13h.01M11.8 16h.01M11.8 19h.01" />
        </>
      );
    case "cloud":
      return <path d="M10.6 23c-2.6 0-4.8-1.9-4.8-4.4 0-2.3 1.8-4.2 4.2-4.4.7-3 3.3-5.2 6.4-5.2 3.7 0 6.7 2.9 6.7 6.5v.2c1.8.5 3.1 2.2 3.1 4.1 0 2.4-2.1 4.3-4.7 4.3H10.6Z" fill="none" />;
    case "internet":
      return (
        <>
          <circle cx="16" cy="16" r="8.2" fill="none" />
          <path d="M16 7.9c2.3 2.3 3.6 5.1 3.6 8.1s-1.3 5.8-3.6 8.1c-2.3-2.3-3.6-5.1-3.6-8.1s1.3-5.8 3.6-8.1Z" />
          <path d="M8.2 16h15.6" />
          <path d="M10.1 11.5c1.9 1 3.9 1.5 5.9 1.5s4-.5 5.9-1.5" />
          <path d="M10.1 20.5c1.9-1 3.9-1.5 5.9-1.5s4 .5 5.9 1.5" />
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
    <svg viewBox="0 0 32 32" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <PathSet type={type} />
    </svg>
  );
}
