// Admin area layout (plan 07): EN-only operator tool, exempt from the i18n
// gate (scripts/check-strings.ts). The role gate here is UX — the real
// boundary is the API's adminPrefixGuard (401/403 on /api/v1/admin/*).

import { useEffect } from 'react'
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AdminShell } from './-components/AdminShell'
import { useSession } from '@/lib/useSession'

export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  component: AdminLayout,
})

function AdminLayout() {
  const session = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (session.isError || (session.data && session.data.role !== 'admin')) {
      void navigate({
        to: '/$locale/login',
        params: { locale: 'pl' },
        replace: true,
      })
    }
  }, [session.isError, session.data, navigate])

  // Ops-console dark theme (plan 07 UI pass): scoped to /admin by toggling
  // the root class so portal-mounted chrome (dialogs, dropdowns, tooltips)
  // inherits it too; restored on unmount. Client-only — the gate above
  // already keeps this tree off the SSR path.
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => document.documentElement.classList.remove('dark')
  }, [])

  if (!session.data || session.data.role !== 'admin') return null

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
