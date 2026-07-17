// Article diagram (plans/seo/05): a wall cross-section built from whole
// extrusion beads. Every visible label arrives via props from the MDX file,
// so the component stays locale-free (and invisible to check-strings).

export function WallThicknessDiagram({
  title,
  beadLabel,
  totalLabel,
}: {
  title: string
  /** e.g. "1 bead = 0.4 mm" */
  beadLabel: string
  /** e.g. "3 beads = 1.2 mm wall" */
  totalLabel: string
}) {
  return (
    <svg
      viewBox="0 0 420 190"
      role="img"
      aria-label={title}
      className="w-full max-w-md"
    >
      {/* three extrusion beads seen end-on */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={150 + i * 42}
          y={30}
          width={38}
          height={100}
          rx={17}
          className="fill-primary/20 stroke-primary"
          strokeWidth={2}
        />
      ))}
      {/* bead width callout */}
      <line
        x1={150}
        y1={18}
        x2={188}
        y2={18}
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-muted-foreground"
        markerStart="url(#wt-tick)"
        markerEnd="url(#wt-tick)"
      />
      <text
        x={120}
        y={22}
        textAnchor="end"
        fontSize={12}
        className="fill-muted-foreground font-mono"
      >
        {beadLabel}
      </text>
      {/* total width bracket */}
      <line
        x1={150}
        y1={152}
        x2={272}
        y2={152}
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-foreground"
        markerStart="url(#wt-tick)"
        markerEnd="url(#wt-tick)"
      />
      <text
        x={211}
        y={176}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        className="fill-foreground font-mono"
      >
        {totalLabel}
      </text>
      <defs>
        <marker
          id="wt-tick"
          markerWidth={2}
          markerHeight={10}
          refX={1}
          refY={5}
          orient="auto"
        >
          <line
            x1={1}
            y1={0}
            x2={1}
            y2={10}
            stroke="currentColor"
            strokeWidth={2}
          />
        </marker>
      </defs>
    </svg>
  )
}
