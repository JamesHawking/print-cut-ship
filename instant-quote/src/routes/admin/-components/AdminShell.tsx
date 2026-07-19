import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

const NAV = [
  { to: '/admin', label: 'Board' },
  { to: '/admin/pricing', label: 'Pricing' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/step-requests', label: 'STEP queue' },
] as const

// Minimal operator frame: wordmark + section nav. No SiteHeader, no
// LocaleSwitcher — this is the EN-only back office, not the shop.
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 font-mono text-xs tracking-widest uppercase sm:px-6">
          <Link to="/admin" className="text-foreground font-bold">
            MICRO_FACTORY
          </Link>
          <span className="text-muted-foreground text-[0.6rem]">admin</span>
          <nav className="flex items-center gap-4 sm:gap-5">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/admin' }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                activeProps={{ className: 'text-foreground' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
