// Table-of-contents shape emitted by @stefanprobst/rehype-extract-toc's
// mdx export plugin (bun-safe — plain types + pure logic).

export interface TocEntry {
  value: string
  /** Heading level: h2 → 2, h3 → 3, ... */
  depth: number
  /** Anchor id from rehype-slug; present for rendered headings. */
  id?: string
  children?: Array<TocEntry>
}

/**
 * h2/h3 entries with anchors, flattened in document order. The article
 * shows a ToC only when this yields 4+ entries (seo_prompts/05).
 */
export function flattenToc(entries: ReadonlyArray<TocEntry>): TocEntry[] {
  const flat: TocEntry[] = []
  const walk = (nodes: ReadonlyArray<TocEntry>) => {
    for (const node of nodes) {
      if (node.depth >= 2 && node.depth <= 3 && node.id) flat.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(entries)
  return flat
}
