import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { brtDay, resolvePeriod } from '@/domain/adminDashboard'
import { filtersFromParams, filtersToParams, rangeError, toRpcFilters, type Explorer, type ExplorerFilters, type Movement } from '@/domain/financeExplorer'
import { fetchFinanceExplorer, type ExplorerQuery } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'

export type SortKey = ExplorerQuery['sort']
export type SortDir = ExplorerQuery['dir']

export const PAGE_SIZES = [25, 50, 100] as const
/** Teto da exportação numa chamada; acima disso a tela pede um recorte menor. */
export const EXPORT_LIMIT = 5000

export interface TableState {
  readonly page: number
  readonly pageSize: number
  readonly sort: SortKey
  readonly dir: SortDir
  readonly search: string
}

const INITIAL_TABLE: TableState = { page: 1, pageSize: 25, sort: 'occurred_at', dir: 'desc', search: '' }

/**
 * Filtros na URL (recarregar e compartilhar mantém o recorte) e uma consulta por mudança. Enquanto
 * recarrega, a tela mantém os números anteriores apagados; resposta atrasada de um filtro antigo é
 * descartada.
 */
export function useFinanceExplorer() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(params), [params])
  const today = brtDay(new Date())
  const period = useMemo(
    () => resolvePeriod(filters.preset, new Date(), { start: filters.start || today, end: filters.end || today }),
    // `today` nas dependências: virou o dia, "Hoje" passa a ser o novo dia.
    [filters.preset, filters.start, filters.end, today],
  )
  const invalidRange = rangeError(filters)
  const [table, setTable] = useState<TableState>(INITIAL_TABLE)
  const [data, setData] = useState<Explorer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  const rpcFilters = useMemo(() => (period && !invalidRange ? toRpcFilters(filters, period) : null), [filters, period, invalidRange])
  const filtersKey = JSON.stringify(rpcFilters)

  const setFilters = useCallback(
    (next: ExplorerFilters) => {
      setParams((current) => filtersToParams(next, current), { replace: true })
      setTable((current) => ({ ...current, page: 1 }))
    },
    [setParams],
  )

  const load = useCallback(async () => {
    if (!rpcFilters) {
      setLoading(false)
      return
    }
    const id = (request.current += 1)
    setLoading(true)
    try {
      const result = await fetchFinanceExplorer({ filters: rpcFilters, ...table })
      if (id !== request.current) return
      setData(result)
      setError(null)
    } catch (loadError) {
      if (id !== request.current) return
      setError(errorMessage(loadError))
    } finally {
      if (id === request.current) setLoading(false)
    }
    // `filtersKey` resume `rpcFilters`: a consulta só refaz quando o recorte muda de verdade.
  }, [filtersKey, table])

  useEffect(() => {
    void load()
  }, [load])

  /** Todas as linhas do recorte (até o teto), na ordem e busca da tabela, para exportar. */
  const loadAll = useCallback(async (): Promise<{ rows: Movement[]; total: number; data: Explorer } | null> => {
    if (!rpcFilters) return null
    const result = await fetchFinanceExplorer({ filters: rpcFilters, ...table, page: 1, pageSize: EXPORT_LIMIT })
    return { rows: result.table.rows, total: result.table.total, data: result }
  }, [rpcFilters, table])

  return {
    filters,
    setFilters,
    period,
    invalidPeriod: period === null,
    invalidRange,
    table,
    setTable,
    data,
    loading,
    error,
    reload: load,
    loadAll,
  }
}
