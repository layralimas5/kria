import { InsightsList } from '@/components/admin/center/InsightsList'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { financeInsights } from '@/domain/financeExplorer'
import { useFinanceExplorer } from '@/hooks/useFinanceExplorer'
import { ChartsSection } from './ChartsSection'
import { FilterBar } from './FilterBar'
import { KpiSection } from './KpiSection'
import { MovementsTable } from './MovementsTable'
import { RankingSection } from './RankingSection'

/**
 * Central financeira: um recorte (período + filtros) que vale para indicadores, gráficos e tabela.
 * Tudo vem de `admin_finance_explorer`; a tela só formata e compara.
 */
export function FinanceCentral({ minMarginRate }: { readonly minMarginRate?: number }) {
  const explorer = useFinanceExplorer()
  const { data, loading, error } = explorer
  const stale = loading && data !== null

  return (
    <div className="space-y-8">
      <FilterBar
        filters={explorer.filters}
        onChange={explorer.setFilters}
        options={data?.options ?? null}
        invalidPeriod={explorer.invalidPeriod}
        invalidRange={explorer.invalidRange}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!data && loading && (
        <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando o financeiro">
          <Spinner className="size-6" />
        </div>
      )}
      {data && (
        <div aria-busy={stale} className="space-y-10">
          <p className="sr-only" aria-live="polite">
            {stale ? 'Atualizando os números do recorte.' : ''}
          </p>
          <KpiSection data={data} />
          <InsightsList insights={financeInsights(data, minMarginRate)} />
          <ChartsSection data={data} stale={stale} />
          <RankingSection data={data} />
          <MovementsTable data={data} table={explorer.table} onTable={explorer.setTable} loading={loading} loadAll={explorer.loadAll} />
        </div>
      )}
    </div>
  )
}
