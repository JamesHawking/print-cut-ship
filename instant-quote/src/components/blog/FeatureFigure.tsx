// Diagram panel for the blog index feature slot (design 1b): the layer-stack
// motif with XY/Z load arrows, a corner "Fig. 01" caption and a factual
// annotation. Caption/annotation arrive via props from the blogPages
// dictionary (per translationKey), so the component stays locale-free.

export function FeatureFigure({
  caption,
  annotation,
}: {
  caption?: string
  annotation?: string
}) {
  return (
    <div className="bg-primary/5 relative flex items-center justify-center border-b p-8 md:border-r md:border-b-0">
      {caption !== undefined && (
        <span className="text-muted-foreground absolute top-3.5 left-4 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
          {caption}
        </span>
      )}
      <svg
        viewBox="0 0 340 220"
        role="img"
        aria-label={caption ?? 'FDM'}
        className="w-full max-w-sm"
      >
        {[46, 72, 98, 124, 150].map((y) => (
          <rect
            key={y}
            x={50}
            y={y}
            width={180}
            height={20}
            rx={10}
            className="fill-primary/20 stroke-primary"
            strokeWidth={2}
          />
        ))}
        {/* XY (in-plane) */}
        <line
          x1={248}
          y1={108}
          x2={308}
          y2={108}
          stroke="currentColor"
          strokeWidth={2.5}
          className="text-foreground"
        />
        <path d="M308 103 L318 108 L308 113 z" className="fill-foreground" />
        <text
          x={248}
          y={94}
          fontSize={11}
          fontWeight={700}
          className="fill-foreground font-mono"
        >
          XY
        </text>
        {/* Z (across layers) */}
        <line
          x1={140}
          y1={38}
          x2={140}
          y2={14}
          stroke="currentColor"
          strokeWidth={2.5}
          className="text-muted-foreground"
        />
        <path d="M135 14 L140 4 L145 14 z" className="fill-muted-foreground" />
        <text
          x={152}
          y={16}
          fontSize={11}
          className="fill-muted-foreground font-mono"
        >
          Z
        </text>
        {annotation !== undefined && (
          <text
            x={50}
            y={204}
            fontSize={10}
            letterSpacing={1.5}
            className="fill-muted-foreground font-mono"
          >
            {annotation}
          </text>
        )}
      </svg>
    </div>
  )
}
