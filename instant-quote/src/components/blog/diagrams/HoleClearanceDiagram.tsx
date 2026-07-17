// Article diagram: a printed hole comes out smaller than modeled — dashed
// nominal circle vs solid as-printed bore. Labels via props.

export function HoleClearanceDiagram({
  title,
  nominalLabel,
  printedLabel,
}: {
  title: string
  /** e.g. "modeled Ø 10.0 mm" */
  nominalLabel: string
  /** e.g. "printed ≈ Ø 9.7 mm" */
  printedLabel: string
}) {
  return (
    <svg
      viewBox="0 0 420 200"
      role="img"
      aria-label={title}
      className="w-full max-w-md"
    >
      {/* part body */}
      <rect
        x={40}
        y={30}
        width={180}
        height={140}
        rx={8}
        className="fill-primary/10 stroke-primary"
        strokeWidth={2}
      />
      {/* nominal (modeled) bore */}
      <circle
        cx={130}
        cy={100}
        r={52}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray="6 5"
        className="text-muted-foreground"
      />
      {/* as-printed bore */}
      <circle
        cx={130}
        cy={100}
        r={42}
        className="fill-background stroke-foreground"
        strokeWidth={2.5}
      />
      {/* callouts */}
      <line
        x1={168}
        y1={62}
        x2={252}
        y2={44}
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-muted-foreground"
      />
      <text
        x={258}
        y={48}
        fontSize={12}
        className="fill-muted-foreground font-mono"
      >
        {nominalLabel}
      </text>
      <line
        x1={160}
        y1={130}
        x2={252}
        y2={152}
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-foreground"
      />
      <text
        x={258}
        y={156}
        fontSize={12}
        fontWeight={700}
        className="fill-foreground font-mono"
      >
        {printedLabel}
      </text>
    </svg>
  )
}
