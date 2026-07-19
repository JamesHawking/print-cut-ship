import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/customers')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/customers"!</div>
}
