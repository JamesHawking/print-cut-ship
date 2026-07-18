import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
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
import { NavigationMenuLink } from '@/components/ui/navigation-menu'
import { FAMILY_DOT } from '../Materials'

/**
 * The three mega-menu panels (materials / compare / blog). Square TE-blunt
 * language echoing the mobile menu: hairline rows, mono microcopy, an orange
 * section numeral with a dashed rule as the panel nameplate. Rows are real
 * router links via NavigationMenuLink asChild, so Radix keeps its keyboard
 * contract inside the menu. Row classes live on NavigationMenuLink itself —
 * cn()/twMerge then resolves the shadcn base (flex-col, hover:bg-accent) in
 * our favour.
 */

type MaterialId = keyof Dictionary['materials']

function slugFor(id: string): MaterialSlug | undefined {
  return PUBLISHED_MATERIALS.find((p) => p.id === id)?.slug
}

// Self-contained panel context — the bar's mono/uppercase is NOT inherited
// into the Radix viewport, so each panel sets its own.
const panelClass = 'bg-background font-mono uppercase'

function PanelNameplate({
  n,
  label,
  count,
}: {
  n: string
  label: string
  count: number
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 border-b px-4 py-2.5 text-[9px] font-bold tracking-[0.16em]">
      <span aria-hidden className="text-primary-text">
        {n}
      </span>
      {label}
      <span
        aria-hidden
        className="border-foreground/10 flex-1 border-t border-dashed"
      />
      {/* List size at a glance: materials shows the full count (the panel IS
          the whole catalog), blog/compare the published total. */}
      <span aria-hidden className="tabular-nums">
        {String(count).padStart(2, '0')}
      </span>
    </div>
  )
}

function PanelFooter({ label, indexKey }: { label: string; indexKey: string }) {
  const locale = useLocale()
  return (
    <NavigationMenuLink
      asChild
      className="text-primary-text hover:bg-secondary/60 hover:text-foreground block rounded-none px-4 py-2.5 text-[10px] font-bold tracking-[0.14em] uppercase transition-colors"
    >
      <Link to="/$locale/$section" params={{ locale, section: indexKey }}>
        {label}
      </Link>
    </NavigationMenuLink>
  )
}

const rowClass =
  'hover:bg-secondary/60 hover:text-foreground flex-row items-center justify-between gap-3 rounded-none border-b px-4 py-2.5 transition-colors'

export function MaterialsPanel() {
  const strings = useStrings()
  const locale = useLocale()
  return (
    <div className={cn(panelClass, 'w-[min(560px,84vw)]')}>
      <PanelNameplate
        n={navNumeral('materials')}
        label={strings.nav.materials}
        count={MATERIALS.length}
      />
      <ul className="grid grid-cols-2 gap-x-0">
        {MATERIALS.map((m) => {
          const d = strings.materials[m.id as MaterialId]
          const slug = slugFor(m.id)
          const cells = (
            <>
              <span className="text-[13px] font-bold whitespace-nowrap">
                {m.label}
              </span>
              {slug ? (
                <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[9px] tracking-[0.12em] whitespace-nowrap">
                  <span
                    aria-hidden
                    className={cn(
                      'size-[7px] rounded-full',
                      FAMILY_DOT[d.family],
                    )}
                  />
                  {strings.materialFamilies[d.family]}
                </span>
              ) : (
                <span className="text-muted-foreground/70 border-foreground/15 shrink-0 border px-1.5 py-0.5 text-[9px] tracking-[0.12em] whitespace-nowrap">
                  {strings.materialsSection.guideSoonShort}
                </span>
              )}
            </>
          )
          return (
            <li key={m.id}>
              {slug ? (
                <NavigationMenuLink asChild className={rowClass}>
                  <Link
                    to="/$locale/$section/$detail"
                    params={{
                      locale,
                      section: MATERIALS_SECTION[locale],
                      detail: slug,
                    }}
                  >
                    {cells}
                  </Link>
                </NavigationMenuLink>
              ) : (
                <span className={cn(rowClass, 'flex opacity-60')}>{cells}</span>
              )}
            </li>
          )
        })}
      </ul>
      <PanelFooter
        label={strings.materialsPages.allMaterialsLink}
        indexKey={MATERIALS_SECTION[locale]}
      />
    </div>
  )
}

export function ComparePanel() {
  const strings = useStrings()
  const locale = useLocale()
  const copy = compareCopy(locale)
  return (
    <div className={cn(panelClass, 'w-[min(400px,84vw)]')}>
      <PanelNameplate
        n={navNumeral('compare')}
        label={strings.nav.compare}
        count={COMPARISONS.length}
      />
      <ul>
        {COMPARISONS.map((c) => (
          <li key={c.slug}>
            <NavigationMenuLink asChild className={rowClass}>
              <Link
                to="/$locale/$section/$detail"
                params={{
                  locale,
                  section: COMPARE_SECTION[locale],
                  detail: c.slug,
                }}
              >
                <span className="text-[13px] font-bold whitespace-nowrap">
                  {copy[c.slug].title}
                </span>
              </Link>
            </NavigationMenuLink>
          </li>
        ))}
      </ul>
      <PanelFooter
        label={`${strings.comparePages.allComparisonsTitle} →`}
        indexKey={COMPARE_SECTION[locale]}
      />
    </div>
  )
}

export function BlogPanel() {
  const strings = useStrings()
  const locale = useLocale()
  return (
    <div className={cn(panelClass, 'w-[min(460px,84vw)]')}>
      <PanelNameplate
        n={navNumeral('blog')}
        label={strings.nav.blog}
        count={blogPosts(locale).length}
      />
      <ul>
        {blogPosts(locale)
          .slice(0, 3)
          .map((post) => (
            <li key={post.slug}>
              <NavigationMenuLink
                asChild
                className={cn(rowClass, 'flex-col items-start gap-1')}
              >
                <Link
                  to="/$locale/$section/$detail"
                  params={{
                    locale,
                    section: BLOG_SECTION[locale],
                    detail: post.slug,
                  }}
                >
                  <span className="text-muted-foreground text-[9px] tracking-[0.14em] tabular-nums">
                    {post.date}
                  </span>
                  <span className="text-[13px] leading-snug font-bold text-pretty">
                    {post.fm.title}
                  </span>
                </Link>
              </NavigationMenuLink>
            </li>
          ))}
      </ul>
      <PanelFooter
        label={`${strings.blogPages.allGuidesTitle} →`}
        indexKey={BLOG_SECTION[locale]}
      />
    </div>
  )
}
