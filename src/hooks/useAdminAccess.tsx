import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AdminMe } from '@/domain/adminDashboard'

// Papel e permissões de quem está no painel, lidos do banco (`admin_me`). Servem só para
// decidir o que mostrar: cada função `admin_*` confere a permissão de novo no servidor.

interface AdminAccess {
  readonly me: AdminMe
  readonly can: (permission: string) => boolean
}

const AdminAccessContext = createContext<AdminAccess | null>(null)

export function AdminAccessProvider({ me, children }: { readonly me: AdminMe; readonly children: ReactNode }) {
  const value = useMemo<AdminAccess>(() => ({ me, can: (permission) => me.permissions.includes(permission) }), [me])
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
}

export function useAdminAccess(): AdminAccess {
  const access = useContext(AdminAccessContext)
  if (!access) throw new Error('useAdminAccess fora do painel de operação')
  return access
}
