// Admin sidebar (plan 07 UI pass): shadcn sidebar-07 pattern adapted to
// TanStack Router. Attention badges pin live counts (must-ship today, new
// STEP requests). EN-only (i18n-exempt directory).

import {
  ChevronsUpDown,
  Factory,
  FileBox,
  LayoutDashboard,
  LogOut,
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

function useAttentionCounts() {
  const ops = useQuery({
    queryKey: ['admin', 'ops', 'today'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/ops/today')
      return res.data ?? null
    },
    refetchInterval: REFETCH_MS,
  })
  const stepNew = useQuery({
    queryKey: ['admin', 'step-requests', 'new-count'],
    queryFn: async () => {
      const res = await api.GET('/api/v1/admin/step-requests', {
        params: { query: { status: 'new' } },
      })
      return res.data ?? null
    },
    refetchInterval: REFETCH_MS,
  })
  return {
    mustShip: ops.data?.orders.length ?? 0,
    stepNew: stepNew.data?.requests.length ?? 0,
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

const CHIP_PRIMARY = 'bg-primary text-primary-foreground'
const CHIP_HIGHLIGHT = 'bg-highlight text-highlight-foreground'

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { mustShip, stepNew } = useAttentionCounts()

  const groups: Array<{ label: string; items: Array<NavItem> }> = [
    {
      label: 'Operations',
      items: [
        {
          to: '/admin',
          label: 'Board',
          icon: LayoutDashboard,
          exact: true,
          badge: mustShip,
          badgeClass: CHIP_PRIMARY,
        },
        {
          to: '/admin/step-requests',
          label: 'STEP queue',
          icon: FileBox,
          badge: stepNew,
          badgeClass: CHIP_HIGHLIGHT,
        },
      ],
    },
    {
      label: 'Config',
      items: [
        { to: '/admin/pricing', label: 'Pricing', icon: SlidersHorizontal },
      ],
    },
    {
      label: 'Support',
      items: [{ to: '/admin/customers', label: 'Customers', icon: Users }],
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
