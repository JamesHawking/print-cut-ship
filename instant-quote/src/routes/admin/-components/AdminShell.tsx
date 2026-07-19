// Admin frame (plan 07 UI pass): collapsible shadcn sidebar + sticky header
// with breadcrumb. EN-only (i18n-exempt directory).

import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'

import { AppSidebar } from './AppSidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

// Crumb derivation: longest prefix wins (order matters — '/admin/orders/'
// before '/admin/orders'). A parent renders as a linked crumb; sibling pages
// stand alone (the sidebar is their nav, Dashboard is not their parent).
const CRUMBS: Array<{
  prefix: string
  title: string | ((pathname: string) => string)
  parent?: { label: string; to: string }
}> = [
  {
    prefix: '/admin/orders/',
    title: (p) => p.split('/').pop() ?? '',
    parent: { label: 'Orders', to: '/admin/orders' },
  },
  { prefix: '/admin/orders', title: 'Orders' },
  { prefix: '/admin/pricing', title: 'Pricing' },
  { prefix: '/admin/customers', title: 'Customers' },
  { prefix: '/admin/step-requests', title: 'STEP queue' },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const match = CRUMBS.find((c) => pathname.startsWith(c.prefix))
  const title = match
    ? typeof match.title === 'function'
      ? match.title(pathname)
      : match.title
    : 'Dashboard'

  return (
    <TooltipProvider>
      <div className="dark bg-background text-foreground min-h-screen">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  {match?.parent && (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link to={match.parent.to}>{match.parent.label}</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                    </>
                  )}
                  <BreadcrumbItem>
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </TooltipProvider>
  )
}
