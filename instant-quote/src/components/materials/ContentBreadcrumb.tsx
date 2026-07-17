import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useLocale } from '@/lib/i18n'
import { SECTIONS, type SectionKey } from '@/content/sections'

export interface CrumbItem {
  label: string
  /** 'home' → the locale landing; a section key → its localized index.
      Omitted on the current page. */
  to?: 'home' | SectionKey
}

/** Content-page breadcrumb in the site's mono-caption voice. */
export function ContentBreadcrumb({ items }: { items: CrumbItem[] }) {
  const locale = useLocale()
  return (
    <Breadcrumb>
      <BreadcrumbList className="font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.to === undefined ? (
                <BreadcrumbPage className="text-foreground font-bold">
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  {item.to === 'home' ? (
                    <Link to="/$locale" params={{ locale }}>
                      {item.label}
                    </Link>
                  ) : (
                    <Link
                      to="/$locale/$section"
                      params={{ locale, section: SECTIONS[item.to][locale] }}
                    >
                      {item.label}
                    </Link>
                  )}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
