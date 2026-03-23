import type { CSSProperties } from "react";

export function DigitalTwinIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="6" width="10" height="20" rx="2.5" />
      <rect x="17" y="6" width="10" height="20" rx="2.5" strokeDasharray="3 2" />
      <path d="M15 10h2M15 16h2M15 22h2" />
      <path d="M9 11h2m0 5H9m0 5h2" />
      <path d="M21 11h2m0 5h-2m0 5h2" />
    </svg>
  );
}
