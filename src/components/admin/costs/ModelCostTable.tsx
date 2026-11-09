import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { KIND_LABELS } from '@/domain/adminAnalytics'
import { providerLabel, UNIT_LABELS, unitPriceUsd, type AiCosts } from '@/domain/aiCosts'
import { formatBrlValue, formatNumber, formatPercent, formatUsd } from '../finance/format'

const TH = 'px-3 py-3 font-bold whitespace-nowrap'

/** Uma linha por modelo, com custo real da tarifa e o que o Vynkio cobra em créditos. */
export function ModelCostTable({ data, onOpen }: { readonly data: AiCosts; readonly onOpen: (slug: string) => void }) {
  return (
    <section aria-labelledby="model-table" className="space-y-3">
      <h2 id="model-table" className="font-headline text-xl text-zinc-50">
        Custo por modelo
      </h2>
      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-white/[0.06]">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <caption className="sr-only">Modelos de IA com custo, créditos, utilizações e situação</caption>
          <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className={TH}>Provedor</th>
              <th scope="col" className={TH}>Modelo</th>
              <th scope="col" className={TH}>Categoria</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Custo unitário</th>
              <th scope="col" className={TH}>Unidade</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Custo/geração</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Créditos</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Margem</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Utilizações</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Custo acumulado</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}><span className="sr-only">Detalhes</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {data.models.map((model) => {
              const target = model.target_margin_rate ?? data.min_margin_rate
              const low = model.unit_margin !== null && model.unit_margin < target
              return (
                <tr key={model.slug} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-3 text-zinc-300">{providerLabel(model.provider)}</td>
                  <td className="px-3 py-3">
                    <span className="block font-semibold text-zinc-100">{model.name}</span>
                    <code className="block max-w-56 truncate text-[11px] text-zinc-500">{model.endpoint}</code>
                  </td>
                  <td className="px-3 py-3 text-zinc-300">{KIND_LABELS[model.kind] ?? model.kind}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-200">{unitPriceUsd(model).label}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{UNIT_LABELS[model.unit]}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-300">
                    {model.provider_cost_usd === null ? <span className="text-zinc-500">medido por uso</span> : formatUsd(model.provider_cost_usd)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-200">{formatNumber(model.credits)}</td>
                  <td className={clsx('px-3 py-3 text-right tabular-nums font-semibold', low ? 'text-red-300' : 'text-zinc-200')}>
                    {formatPercent(model.unit_margin)}
                    <span className="block text-[11px] font-normal text-zinc-500">meta {formatPercent(target)}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-200">
                    {formatNumber(model.uses_period)}
                    <span className="block text-[11px] text-zinc-500">{formatNumber(model.uses_total)} no total</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-200">
                    {formatBrlValue(model.cost_period_brl)}
                    <span className="block text-[11px] text-zinc-500">{formatBrlValue(model.cost_total_brl)} no total</span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={clsx(
                        'inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold',
                        model.active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.05] text-zinc-400',
                      )}
                    >
                      {model.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(model.slug)}
                      aria-label={`Detalhes e preços de ${model.name}`}
                      className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {data.models.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-zinc-500">
                  Nenhum modelo com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Margem por geração = 1 − custo ÷ (créditos × R$ {data.credit_value_brl.toLocaleString('pt-BR')}). Texto não tem custo fixo por geração: o custo vem dos
        tokens medidos em cada resposta.
      </p>
    </section>
  )
}
