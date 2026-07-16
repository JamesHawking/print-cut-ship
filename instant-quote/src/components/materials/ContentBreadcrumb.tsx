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

export interface CrumbItem {
  label: string
  /** Resolved localized path (slugs module); omitted on the current page. */
  href?: string
}

/** Content-page breadcrumb in the site's mono-caption voice. */
export function ContentBreadcrumb({ items }: { items: CrumbItem[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  {/* Crumb paths come pre-localized from the slugs module —
                      cast past the router's literal route-id typing. */}
                  <Link to={item.href as '/'}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-foreground font-bold">
                  {item.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
