import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSession } from '@/hooks/useSession'
import { Spinner } from './ui/Spinner'

export function RequireAuth({ children }: { readonly children: ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-zinc-500" role="status" aria-label="Carregando">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}
