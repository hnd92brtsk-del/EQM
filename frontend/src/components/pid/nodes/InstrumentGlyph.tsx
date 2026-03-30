type Props = {
  code: string;
  width?: number;
  height?: number;
  stroke?: string;
  selected?: boolean;
};

export function InstrumentGlyph({
  code,
  width = 68,
  height = 68,
  stroke = "#32475b",
  selected = false,
}: Props) {

  return (
    <svg width={width} height={height} viewBox="0 0 68 68" aria-hidden>
      <circle cx="34" cy="34" r="25" fill="white" stroke={stroke} strokeWidth={selected ? "2.75" : "2.25"} />
      <line x1="34" y1="9" x2="34" y2="21" stroke={stroke} strokeWidth="2" />
      <line x1="34" y1="47" x2="34" y2="59" stroke={stroke} strokeWidth="2" />
      <line x1="9" y1="34" x2="21" y2="34" stroke={stroke} strokeWidth="2" />
      <line x1="47" y1="34" x2="59" y2="34" stroke={stroke} strokeWidth="2" />
      <text
        x="34"
        y="38"
        textAnchor="middle"
        fill={stroke}
        fontSize={code.length > 2 ? "12" : "15"}
        fontWeight="700"
        fontFamily="sans-serif"
      >
        {code}
      </text>
    </svg>
  );
}
