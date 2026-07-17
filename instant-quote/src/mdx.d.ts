// Ambient types for compiled MDX modules. The vite pipeline (vite.config)
// attaches the extra exports: remark-mdx-frontmatter → `frontmatter`,
// remark-reading-time/mdx → `readingTime`, @stefanprobst/rehype-extract-toc
// → `tableOfContents`. Do NOT add @types/mdx — its own '*.mdx' wildcard
// declaration would conflict with these typed exports.

declare module '*.mdx' {
  import type { ComponentType } from 'react'

  /** Raw YAML data; the blog registry zod-parses it — never trust as-is. */
  export const frontmatter: unknown
  export const readingTime: {
    text: string
    minutes: number
    time: number
    words: number
  }
  export const tableOfContents: Array<import('@/content/blog/toc').TocEntry>
  const MDXContent: ComponentType<{
    components?: Record<string, ComponentType<never>>
  }>
  export default MDXContent
}
