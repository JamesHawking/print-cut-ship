// Server-backed session (plan 04): the iq_session cookie is the credential,
// GET /api/v1/auth/me resolves it. Replaces the prototype's sessionStorage
// email (lib/session.ts).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

const ME_KEY = ['auth', 'me'] as const

export function useSession() {
  return useQuery({
    queryKey: ME_KEY,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const res = await api.GET('/api/v1/auth/me')
      if (!res.data) throw new Error('unauthorized')
      return res.data
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.POST('/api/v1/auth/logout')
    },
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ME_KEY })
      queryClient.removeQueries({ queryKey: ['orders'] })
    },
  })
}
