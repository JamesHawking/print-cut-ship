import { useLocale, useStrings, type Dictionary } from '@/lib/i18n'
import { MATERIALS } from '@/lib/catalog-static'
import { navNumeral } from '@/content/sections'
import {
  MATERIALS_SECTION,
  PUBLISHED_MATERIALS,
  type MaterialSlug,
} from '@/content/materials/slugs'
import { COMPARE_SECTION, COMPARISONS } from '@/content/compare/slugs'
import { compareCopy } from '@/content/compare/copy'
import { BLOG_SECTION } from '@/content/blog/paths'
// VITE-ONLY module (import.meta.glob): importing it here pulls the MDX posts
// into every chunk that renders the header. Fine at the current post count —
// revisit when registry.ts splits frontmatter from components.
import { blogPosts } from '@/content/blog/registry'
import type { MaterialFamily } from '@/lib/i18n/pl'
import { FAMILY_DOT } from '../Materials'

/**
 * Shared data layer for the nav's section panels — the desktop mega menu
 * (nav-panels.tsx) and the mobile accordion (MobileNav.tsx) render the same
 * rows, so the assembly lives here exactly once: labels, right-side meta
 * (family tag / soon badge / date), link targets (absent `to` = unpublished
 * material, rendered disabled), the nameplate numeral + count, and the
 * "all →" footer (arrow normalized here — the materials string carries its
 * own, compare/blog get it appended).
 */

export { FAMILY_DOT }

export type NavPanelKey = 'materials' | 'compare' | 'blog'

export type NavRowMeta =
  | { kind: 'family'; family: MaterialFamily; label: string }
  | { kind: 'soon'; label: string }
  | { kind: 'date'; label: string }

export interface NavRow {
  key: string
  label: string
  meta?: NavRowMeta
  to?: { section: string; detail: string }
}

export interface NavPanelData {
  key: NavPanelKey
  numeral: string
  label: string
  count: number
  rows: NavRow[]
  footer: { label: string; section: string }
}

type MaterialId = keyof Dictionary['materials']

function slugFor(id: string): MaterialSlug | undefined {
  return PUBLISHED_MATERIALS.find((p) => p.id === id)?.slug
}

export function useNavPanelData(key: NavPanelKey): NavPanelData {
  const strings = useStrings()
  const locale = useLocale()

  switch (key) {
    case 'materials':
      return {
        key,
        numeral: navNumeral(key),
        label: strings.nav.materials,
        count: MATERIALS.length,
        rows: MATERIALS.map((m) => {
          const d = strings.materials[m.id as MaterialId]
          const slug = slugFor(m.id)
          return {
            key: m.id,
            label: m.label,
            meta: slug
              ? {
                  kind: 'family' as const,
                  family: d.family,
                  label: strings.materialFamilies[d.family],
                }
              : {
                  kind: 'soon' as const,
                  label: strings.materialsSection.guideSoonShort,
                },
            to: slug
              ? { section: MATERIALS_SECTION[locale], detail: slug }
              : undefined,
          }
        }),
        footer: {
          label: strings.materialsPages.allMaterialsLink,
          section: MATERIALS_SECTION[locale],
        },
      }
    case 'compare': {
      const copy = compareCopy(locale)
      return {
        key,
        numeral: navNumeral(key),
        label: strings.nav.compare,
        count: COMPARISONS.length,
        rows: COMPARISONS.map((c) => ({
          key: c.slug,
          label: copy[c.slug].title,
          to: { section: COMPARE_SECTION[locale], detail: c.slug },
        })),
        footer: {
          label: `${strings.comparePages.allComparisonsTitle} →`,
          section: COMPARE_SECTION[locale],
        },
      }
    }
    case 'blog': {
      const posts = blogPosts(locale)
      return {
        key,
        numeral: navNumeral(key),
        label: strings.nav.blog,
        count: posts.length,
        rows: posts.slice(0, 3).map((post) => ({
          key: post.slug,
          label: post.fm.title,
          meta: { kind: 'date' as const, label: post.date },
          to: { section: BLOG_SECTION[locale], detail: post.slug },
        })),
        footer: {
          label: `${strings.blogPages.allGuidesTitle} →`,
          section: BLOG_SECTION[locale],
        },
      }
    }
  }
}
