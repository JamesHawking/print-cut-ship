// Article diagram: layer stack with the two load directions — in-plane XY
// (continuous beads) vs Z across layer bonds. Labels via props.

export function AnisotropyDiagram({
  title,
  xyLabel,
  zLabel,
}: {
  title: string
  /** e.g. "XY load — carried by continuous beads" */
  xyLabel: string
  /** e.g. "Z load — carried by layer bonds only" */
  zLabel: string
}) {
  return (
    <svg
      viewBox="0 0 420 210"
      role="img"
      aria-label={title}
      className="w-full max-w-md"
    >
      {/* layer stack */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={60}
          y={40 + i * 24}
          width={200}
          height={20}
          rx={10}
          className="fill-primary/20 stroke-primary"
          strokeWidth={2}
        />
      ))}
      {/* XY arrow (along layers) */}
      <line
        x1={278}
        y1={98}
        x2={348}
        y2={98}
        stroke="currentColor"
        strokeWidth={2.5}
        className="text-foreground"
        markerEnd="url(#an-arrow)"
      />
      <text
        x={286}
        y={86}
        fontSize={12}
        fontWeight={700}
        className="fill-foreground font-mono"
      >
        {xyLabel}
      </text>
      {/* Z arrow (across layer bonds) */}
      <line
        x1={160}
        y1={30}
        x2={160}
        y2={4}
        stroke="currentColor"
        strokeWidth={2.5}
        className="text-muted-foreground"
        markerEnd="url(#an-arrow)"
      />
      <text
        x={172}
        y={16}
        fontSize={12}
        className="fill-muted-foreground font-mono"
      >
        {zLabel}
      </text>
      <defs>
        <marker
          id="an-arrow"
          markerWidth={8}
          markerHeight={8}
          refX={6}
          refY={4}
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  )
}
