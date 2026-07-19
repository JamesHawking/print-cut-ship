// Admin sidebar (plan 07 UI pass): shadcn sidebar-07 pattern adapted to
// TanStack Router. Attention badges pin live counts (must-ship today, new
// STEP requests). EN-only (i18n-exempt directory).

import {
  ChevronsUpDown,
  Factory,
  FileBox,
  LayoutDashboard,
  LogOut,
  Package,
  SlidersHorizontal,
  Store,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { api } from '@/lib/api/client'
import { useLogout, useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'

const REFETCH_MS = 60_000

// One flight for both chips: shares the ['admin','ops','stats'] cache entry
// with the dashboard/board, so the sidebar's refetchInterval keeps their KPIs
// live for free.
function useAttentionCounts() {
  const stats = useQuery({
    queryKey: ['admin', 'ops', 'stats'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/ops/stats')
      return res.data ?? null
    },
    refetchInterval: REFETCH_MS,
  })
  return {
    overdue: stats.data?.overdue ?? 0,
    stepNew: stats.data?.stepNew ?? 0,
  }
}

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  badge?: number
  badgeClass?: string
}

const CHIP_HIGHLIGHT = 'bg-highlight text-highlight-foreground'
const CHIP_DESTRUCTIVE = 'bg-destructive text-destructive-foreground'

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { overdue, stepNew } = useAttentionCounts()

  // Orders chip counts overdue (strictly past ship-by) — an alarm, not the
  // wider "due today" set the dashboard's must-ship card shows.
  const groups: Array<{ label: string; items: Array<NavItem> }> = [
    {
      label: 'Overview',
      items: [
        {
          to: '/admin',
          label: 'Dashboard',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      label: 'Commerce',
      items: [
        {
          to: '/admin/orders',
          label: 'Orders',
          icon: Package,
          badge: overdue,
          badgeClass: CHIP_DESTRUCTIVE,
        },
        {
          to: '/admin/step-requests',
          label: 'STEP queue',
          icon: FileBox,
          badge: stepNew,
          badgeClass: CHIP_HIGHLIGHT,
        },
        { to: '/admin/customers', label: 'Customers', icon: Users },
      ],
    },
    {
      label: 'Config',
      items: [
        { to: '/admin/pricing', label: 'Pricing', icon: SlidersHorizontal },
      ],
    },
  ]

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/admin">
                <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                  <Factory className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col items-start">
                  <span className="font-mono text-xs font-bold tracking-widest uppercase">
                    MICRO_FACTORY
                  </span>
                  <span className="text-muted-foreground font-mono text-[0.55rem] tracking-[0.2em] uppercase">
                    back office
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[0.6rem] tracking-[0.16em] uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item)}
                      tooltip={item.label}
                      className="data-[active=true]:bg-primary-tint data-[active=true]:font-semibold data-[active=true]:shadow-[inset_2px_0_0_0_var(--primary)]"
                    >
                      <Link
                        to={item.to}
                        activeOptions={{ exact: item.exact === true }}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge !== undefined && item.badge > 0 && (
                      <SidebarMenuBadge
                        className={cn(
                          'rounded-full px-1.5 font-mono text-[0.6rem] font-bold',
                          item.badgeClass,
                        )}
                      >
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

function NavUser() {
  const session = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  const email = session.data?.email
  const initials = (email?.slice(0, 2) ?? '··').toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <span className="bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-md font-mono text-[0.65rem] font-bold">
                {initials}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="text-muted-foreground font-mono text-[0.55rem] tracking-[0.2em] uppercase">
                  admin
                </span>
                <span className="w-full truncate text-xs">{email ?? '…'}</span>
              </span>
              <ChevronsUpDown className="text-muted-foreground ml-auto size-4 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/$locale" params={{ locale: 'pl' }}>
                <Store />
                View shop
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={logout.isPending}
              onSelect={() => {
                logout.mutate(undefined, {
                  onSettled: () => {
                    void navigate({
                      to: '/$locale/login',
                      params: { locale: 'pl' },
                    })
                  },
                })
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
