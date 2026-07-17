// Article diagram: the same L-bracket printed in two orientations. Flat —
// layer lines run along the corner and the load; upright — the load peels
// layer bonds apart at the corner. Labels via props.

function Bracket({
  x,
  layerRotate,
  className,
}: {
  x: number
  layerRotate?: string
  className: string
}) {
  return (
    <g transform={`translate(${x} 40)`}>
      <path
        d="M0 0 h30 v70 h70 v30 h-100 z"
        className={className}
        strokeWidth={2.5}
      />
      {/* layer lines */}
      <g
        clipPath="inherit"
        transform={layerRotate}
        className="text-muted-foreground"
      >
        {[14, 28, 42, 56, 70, 84].map((offset) => (
          <line
            key={offset}
            x1={-20}
            y1={offset}
            x2={120}
            y2={offset}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}
      </g>
    </g>
  )
}

export function OrientationStrengthDiagram({
  title,
  flatLabel,
  uprightLabel,
  forceLabel,
}: {
  title: string
  /** e.g. "Printed flat — beads bridge the corner" */
  flatLabel: string
  /** e.g. "Printed upright — the load peels layers apart" */
  uprightLabel: string
  /** e.g. "load" */
  forceLabel: string
}) {
  return (
    <svg
      viewBox="0 0 460 210"
      role="img"
      aria-label={title}
      className="w-full max-w-lg"
    >
      <Bracket x={40} className="fill-primary/20 stroke-primary" />
      <Bracket
        x={280}
        layerRotate="rotate(90 50 50)"
        className="fill-muted stroke-muted-foreground"
      />
      {/* load arrows at the horizontal tip */}
      {[130, 370].map((x) => (
        <g key={x}>
          <line
            x1={x}
            y1={100}
            x2={x}
            y2={128}
            stroke="currentColor"
            strokeWidth={2.5}
            className="text-foreground"
            markerEnd="url(#or-arrow)"
          />
          <text
            x={x + 8}
            y={116}
            fontSize={11}
            className="fill-foreground font-mono"
          >
            {forceLabel}
          </text>
        </g>
      ))}
      <text
        x={90}
        y={190}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        className="fill-foreground font-mono"
      >
        {flatLabel}
      </text>
      <text
        x={330}
        y={190}
        textAnchor="middle"
        fontSize={12}
        className="fill-muted-foreground font-mono"
      >
        {uprightLabel}
      </text>
      <defs>
        <marker
          id="or-arrow"
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
