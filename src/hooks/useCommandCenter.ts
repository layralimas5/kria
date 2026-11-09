import { useCallback } from 'react'
import type { Period } from '@/domain/adminDashboard'
import { composeCenter } from '@/domain/commandCenter'
import { fetchBusiness, fetchCommandCenter, fetchDashboard } from '@/lib/adminApi'
import { useQuery } from './useQuery'

const WHOLE_BASE = { plan: null, model: null, provider: null } as const

/**
 * As três leituras da central em paralelo, para o mesmo período. Enquanto um período novo carrega,
 * a tela continua com os números anteriores, apagados (`loading` com `data`).
 */
export function useCommandCenter(period: Period | null) {
  const load = useCallback(async () => {
    if (!period) return null
    const [dashboard, business, center] = await Promise.all([fetchDashboard(period), fetchBusiness(period, WHOLE_BASE), fetchCommandCenter(period)])
    return composeCenter(dashboard, business, center)
  }, [period])
  return useQuery(load, 'Não deu para carregar a central de comando.')
}
