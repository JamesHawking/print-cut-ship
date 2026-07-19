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

const TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/admin/orders/', title: 'Order' },
  { prefix: '/admin/pricing', title: 'Pricing' },
  { prefix: '/admin/customers', title: 'Customers' },
  { prefix: '/admin/step-requests', title: 'STEP queue' },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const match = TITLES.find((t) => pathname.startsWith(t.prefix))
  const isBoard = pathname === '/admin'
  const shortId =
    match?.prefix === '/admin/orders/' ? pathname.split('/').pop() : undefined

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {isBoard ? (
                  <BreadcrumbItem>
                    <BreadcrumbPage>Board</BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/admin">Board</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {shortId ? `Order ${shortId}` : match?.title}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
