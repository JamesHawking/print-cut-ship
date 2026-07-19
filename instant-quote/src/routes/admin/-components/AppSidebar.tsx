// Admin sidebar (plan 07 UI pass): shadcn sidebar-07 pattern adapted to
// TanStack Router. Attention badges pin live counts (must-ship today, new
// STEP requests). EN-only (i18n-exempt directory).

import {
  ChevronsUpDown,
  FileBox,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
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
}

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
        },
        {
          to: '/admin/step-requests',
          label: 'STEP queue',
          icon: FileBox,
          badge: stepNew,
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/admin">
                <span className="font-mono text-xs font-bold tracking-widest uppercase">
                  MICRO_FACTORY
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item)}
                      tooltip={item.label}
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
                      <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}

function NavUser() {
  const session = useSession()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <span className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="text-muted-foreground text-[0.6rem] tracking-widest uppercase">
                  admin
                </span>
                <span className="w-full truncate text-xs">
                  {session.data?.email ?? '…'}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
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
