import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Brand } from '@/domain/types'
import { useAccount } from './useAccount'
import type { QueryState } from './useQuery'
import { useBrands } from './useWorkspace'

interface ActiveBrandState {
  /** A lista de marcas, carregada uma vez para o topo, o assistente, o Studio e Marcas. */
  readonly brands: QueryState<Brand[]>
  readonly activeBrandId: string | null
  readonly activeBrand: Brand | null
  readonly setActiveBrand: (brandId: string | null) => Promise<void>
}

const ActiveBrandContext = createContext<ActiveBrandState | null>(null)

/** Marca ativa: o contexto que as ferramentas usam sem a pessoa repetir. Fica em `user_preferences`. */
export function ActiveBrandProvider({ children }: { readonly children: ReactNode }) {
  const brands = useBrands()
  const { preferences, setActiveBrand } = useAccount()
  const activeBrandId = preferences?.active_brand_id ?? null

  const value = useMemo<ActiveBrandState>(
    () => ({
      brands,
      activeBrandId,
      activeBrand: brands.data?.find((brand) => brand.id === activeBrandId) ?? null,
      setActiveBrand,
    }),
    [brands, activeBrandId, setActiveBrand],
  )

  return <ActiveBrandContext.Provider value={value}>{children}</ActiveBrandContext.Provider>
}

export function useActiveBrand(): ActiveBrandState {
  const context = useContext(ActiveBrandContext)
  if (!context) throw new Error('useActiveBrand fora do ActiveBrandProvider')
  return context
}
