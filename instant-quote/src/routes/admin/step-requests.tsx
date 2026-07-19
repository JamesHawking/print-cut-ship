import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/step-requests')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/step-requests"!</div>
}
