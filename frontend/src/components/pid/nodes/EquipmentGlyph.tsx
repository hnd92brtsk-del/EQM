type Props = {
  shapeKey: string;
  width?: number;
  height?: number;
};

export function EquipmentGlyph({ shapeKey, width = 64, height = 44 }: Props) {
  const stroke = "#32475b";
  const common = { fill: "none", stroke, strokeWidth: 2 };

  switch (shapeKey) {
    case "crusher_jaw":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <path d="M12 34h40L46 8H18z" {...common} />
          <line x1="18" y1="30" x2="44" y2="14" {...common} />
        </svg>
      );
    case "crusher_cone":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <path d="M16 34h32L32 8z" {...common} />
          <line x1="16" y1="34" x2="48" y2="34" {...common} />
        </svg>
      );
    case "screen_vibratory":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <rect x="10" y="12" width="44" height="20" rx="2" {...common} />
          <line x1="16" y1="16" x2="48" y2="28" {...common} />
          <line x1="16" y1="22" x2="48" y2="34" {...common} />
        </svg>
      );
    case "conveyor_belt":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <rect x="8" y="14" width="48" height="14" rx="3" {...common} />
          <circle cx="14" cy="30" r="4" {...common} />
          <circle cx="50" cy="30" r="4" {...common} />
        </svg>
      );
    case "mill_tumbling":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <ellipse cx="32" cy="22" rx="22" ry="14" {...common} />
          <line x1="14" y1="22" x2="50" y2="22" {...common} />
          <line x1="32" y1="10" x2="32" y2="34" {...common} />
        </svg>
      );
    case "pump_centrifugal":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <circle cx="26" cy="22" r="12" {...common} />
          <polygon points="22,16 34,22 22,28" {...common} />
          <line x1="38" y1="22" x2="54" y2="22" {...common} />
        </svg>
      );
    case "tank_vertical":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <ellipse cx="32" cy="10" rx="14" ry="5" {...common} />
          <path d="M18 10v20c0 3 6 5 14 5s14-2 14-5V10" {...common} />
        </svg>
      );
    case "valve_gate":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <polygon points="16,22 30,12 30,32" {...common} />
          <polygon points="48,22 34,12 34,32" {...common} />
        </svg>
      );
    case "motor":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <circle cx="32" cy="22" r="14" {...common} />
          <text x="32" y="26" textAnchor="middle" fill={stroke} fontSize="13" fontWeight="700">
            M
          </text>
        </svg>
      );
    case "feeder":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <rect x="10" y="14" width="44" height="16" rx="2" {...common} />
          <line x1="16" y1="22" x2="48" y2="22" {...common} />
        </svg>
      );
    case "cyclone":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <path d="M20 8h24l-8 14v10l-8 4v-14z" {...common} />
          <line x1="44" y1="8" x2="52" y2="8" {...common} />
        </svg>
      );
    case "mixer":
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <rect x="16" y="8" width="32" height="24" rx="3" {...common} />
          <line x1="32" y1="8" x2="32" y2="34" {...common} />
          <line x1="24" y1="18" x2="40" y2="24" {...common} />
        </svg>
      );
    default:
      return (
        <svg width={width} height={height} viewBox="0 0 64 44" aria-hidden>
          <rect x="8" y="10" width="48" height="24" rx="3" {...common} />
        </svg>
      );
  }
}
