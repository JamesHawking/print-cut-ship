import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { NavigationMenu as NavigationMenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { useLocale, useStrings } from '@/lib/i18n'
import { SECTIONS } from '@/content/sections'
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from '@/components/ui/navigation-menu'
import { NAV_SECTIONS } from '../SiteHeader'
import { BlogPanel, ComparePanel, MaterialsPanel } from './nav-panels'

/**
 * Desktop (lg+) landing nav as a shadcn/Radix mega menu: materials, compare
 * and blog open hover panels (hover intent via delayDuration, shared
 * viewport crossfade + auto-resize); pricing stays a plain link — it has no
 * children. Pointer contract: hover opens, trigger click navigates to the
 * section index. Keyboard contract (radix's own ArrowDown moves to the next
 * item, and our click-hijack removes its open-on-Enter): ArrowDown opens the
 * panel via the controlled Root value, Enter navigates, Escape closes. The
 * Root composes shadcn primitives directly rather than the wrapped
 * <NavigationMenu> so the viewport can be restyled square.
 */
const PANEL = {
  materials: MaterialsPanel,
  compare: ComparePanel,
  blog: BlogPanel,
} as const

type PanelKey = keyof typeof PANEL

function hasPanel(key: (typeof NAV_SECTIONS)[number]): key is PanelKey {
  return key in PANEL
}

// Same look as the pre-menu links: mono xs uppercase, muted → foreground,
// the active section underlined by the orange bar on the header's hairline.
const itemClass = (active: boolean) =>
  cn(
    'hover:text-foreground relative flex h-14 items-center whitespace-nowrap transition-colors',
    active
      ? "text-foreground after:bg-primary-text after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:content-['']"
      : 'text-muted-foreground',
  )

const triggerClass = (active: boolean) =>
  cn(
    itemClass(active),
    'rounded-none bg-transparent px-0 font-mono text-xs font-medium tracking-widest uppercase hover:bg-transparent focus:bg-transparent focus-visible:ring-0 data-[state=open]:bg-transparent data-[state=open]:hover:bg-transparent data-[state=open]:focus:bg-transparent',
  )

export function DesktopNav({
  activeKey,
  ariaCurrent,
}: {
  activeKey: string | null
  ariaCurrent: 'page' | 'location'
}) {
  const strings = useStrings()
  const locale = useLocale()
  const navigate = useNavigate()
  // Controlled so ArrowDown can open a panel from the keyboard — radix's
  // default open paths (hover, click-toggle) are hover-only for us, since
  // trigger click navigates instead.
  const [value, setValue] = useState('')

  return (
    <>
      {/* Link+hash instead of a plain anchor so the landing jump also works
        from content pages (/materialy/…). exact+hash: otherwise the router
        force-marks this link aria-current="page" on every /$locale/* page;
        the scroll spy owns its current-state instead. */}
      <Link
        to="/$locale"
        params={{ locale }}
        hash="how-it-works"
        activeOptions={{ exact: true, includeHash: true }}
        aria-current={activeKey === 'howItWorks' ? 'location' : undefined}
        className={itemClass(activeKey === 'howItWorks')}
      >
        {strings.nav.howItWorks}
      </Link>
      <NavigationMenuPrimitive.Root
        delayDuration={100}
        value={value}
        onValueChange={setValue}
        className="relative flex max-w-max items-center"
      >
        <NavigationMenuList className="gap-5">
          {NAV_SECTIONS.map((key) => (
            <NavigationMenuItem key={key} value={key}>
              {hasPanel(key) ? (
                <>
                  <NavigationMenuTrigger
                    aria-current={activeKey === key ? ariaCurrent : undefined}
                    onClick={() =>
                      void navigate({
                        to: '/$locale/$section',
                        params: { locale, section: SECTIONS[key][locale] },
                      })
                    }
                    // preventDefault stops radix's own ArrowDown handler
                    // (move-to-next-item) from also running.
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setValue(key)
                      }
                    }}
                    className={triggerClass(activeKey === key)}
                  >
                    {strings.nav[key]}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="p-0">
                    {(() => {
                      const Panel = PANEL[key]
                      return <Panel />
                    })()}
                  </NavigationMenuContent>
                </>
              ) : (
                <NavigationMenuLink asChild>
                  <Link
                    to="/$locale/$section"
                    params={{ locale, section: SECTIONS[key][locale] }}
                    aria-current={activeKey === key ? ariaCurrent : undefined}
                    className={itemClass(activeKey === key)}
                  >
                    {strings.nav[key]}
                  </Link>
                </NavigationMenuLink>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
        <NavigationMenuViewport className="bg-background mt-0 rounded-none shadow-none" />
      </NavigationMenuPrimitive.Root>
    </>
  )
}
