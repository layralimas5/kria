import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { providerLabel } from '@/domain/aiCosts'
import { costPerCredit, type CenterData } from '@/domain/commandCenter'
import { BarList } from '../charts/BarList'
import { SERIES_COLORS } from '../charts/chartColors'
import { LineChart } from '../charts/LineChart'
import { CenterSection } from './CenterLayout'
import { axisBrl, count, moneyFromBrl, pct } from './format'
import { MetricCard, MetricGrid } from './MetricCard'

const [, GOLD, SKY, PINK] = SERIES_COLORS
const TH = 'px-3 py-2.5 font-bold whitespace-nowrap'

/** Quanto custa entregar a IA: por dia, provedor, modelo, funcionalidade e pessoa. */
export function AiSection({ data }: { readonly data: CenterData }) {
  const { center, business, features } = data
  const ai = center.ai
  const value = center.settings.credit_value_brl
  const perCredit = costPerCredit(center)
  const avgPerGeneration = ai.events > 0 ? ai.cost_brl / ai.events : null
  const revenueEstimate = ai.credits * value
  const margin = revenueEstimate > 0 ? 1 - ai.cost_brl / revenueEstimate : null
  const costSpark = ai.series.map((day) => day.cost_brl)

  return (
    <CenterSection id="ia" title="Inteligências artificiais" question="Quanto custa, de verdade, oferecer IA para cada pessoa e cada recurso.">
      <MetricGrid>
        <MetricCard label="Custo de IA hoje" value={moneyFromBrl(ai.cost_today_brl)} info="Custo registrado das gerações cobradas pelo fornecedor desde 0h (Brasília). Não depende do filtro." to="/admin/modelos" />
        <MetricCard label="Custo de IA no mês" value={moneyFromBrl(ai.cost_month_brl)} info="Desde o dia 1º do mês corrente. Não depende do filtro." spark={costSpark} sparkColor={PINK} />
        <MetricCard
          label="Custo no período"
          value={moneyFromBrl(ai.cost_brl)}
          upIsGood={false}
          change={business.ai.cost_previous_brl > 0 ? (business.ai.cost_brl - business.ai.cost_previous_brl) / business.ai.cost_previous_brl : null}
          hint={ai.unknown > 0 ? `${count(ai.unknown)} gerações sem tarifa ficaram fora` : 'Tokens medidos ou tarifa × uso'}
          tone={ai.unknown > 0 ? 'bad' : undefined}
          info="Soma do custo em reais de cada geração cobrada (sucesso ou falha que o fornecedor cobrou), pelo câmbio do dia da geração. Texto usa os tokens medidos; imagem e vídeo usam a tarifa cadastrada × o uso."
        />
        <MetricCard label="Custo médio por geração" value={moneyFromBrl(avgPerGeneration)} info="Custo de IA no período ÷ gerações cobradas pelo fornecedor." />
        <MetricCard label="Gerações realizadas" value={count(ai.events)} info="Gerações que o fornecedor cobrou no período." spark={ai.series.map((day) => day.generations)} />
        <MetricCard label="Créditos consumidos" value={count(ai.credits)} info="Créditos debitados das gerações concluídas no período. Crédito não é dinheiro: o custo real está ao lado." />
        <MetricCard
          label="Créditos concedidos e não usados"
          value={count(business.credits.available)}
          hint={`${count(business.credits.distributed)} distribuídos no período`}
          info="Saldo somado de todas as carteiras agora. É compromisso: vira custo de IA quando for usado."
        />
        <MetricCard
          label="Receita estimada por crédito"
          value={moneyFromBrl(value)}
          badge="Estimado"
          hint={perCredit === null ? 'Sem consumo para medir o custo' : `Custo real ${moneyFromBrl(perCredit)} por crédito · margem ${pct(margin) ?? '–'}`}
          tone={margin !== null && margin < 0 ? 'bad' : undefined}
          info="Valor de referência do crédito cadastrado em Preços. A margem compara esse valor com o custo real de IA por crédito consumido no período."
        />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <LineChart
          title="Evolução do custo diário de IA"
          series={[{ key: 'cost', label: 'Custo de IA', color: PINK }]}
          points={ai.series.map((day) => ({ key: day.day, values: { cost: day.cost_brl } }))}
          format={axisBrl}
          area
        />
        <BarList
          title="Consumo financeiro por IA (modelos mais caros)"
          color={PINK}
          emptyText="Nenhuma geração cobrada no período."
          rows={ai.by_model.map((model) => ({
            key: model.model_slug,
            label: model.name ?? model.model_slug,
            value: model.cost_brl,
            display: moneyFromBrl(model.cost_brl) ?? '',
            detail: `${providerLabel(model.provider)} · ${count(model.generations)} gerações · ${moneyFromBrl(model.generations > 0 ? model.cost_brl / model.generations : null) ?? '–'} cada`,
          }))}
        />
        <BarList
          title="Custo por provedor"
          color={GOLD}
          emptyText="Nenhuma geração cobrada no período."
          rows={groupProviders(ai.by_model).map((row) => ({
            key: row.provider,
            label: providerLabel(row.provider),
            value: row.cost,
            display: moneyFromBrl(row.cost) ?? '',
            detail: `${count(row.generations)} gerações · ${pct(ai.cost_brl > 0 ? row.cost / ai.cost_brl : null) ?? '–'} do custo`,
          }))}
        />
        <BarList
          title="Consumo por funcionalidade"
          color={SKY}
          emptyText="Nenhuma geração cobrada no período."
          rows={features.map((feature) => ({
            key: feature.feature,
            label: feature.label,
            value: feature.costBrl,
            display: moneyFromBrl(feature.costBrl) ?? '',
            detail: `${count(feature.generations)} gerações · ${count(feature.users)} pessoas · margem ${pct(feature.margin) ?? '–'}`,
          }))}
        />
      </div>

      <FeatureTable data={data} />
      <TopUsers data={data} />
    </CenterSection>
  )
}

function groupProviders(models: CenterData['center']['ai']['by_model']) {
  const map = new Map<string, { provider: string; cost: number; generations: number }>()
  for (const model of models) {
    const row = map.get(model.provider) ?? { provider: model.provider, cost: 0, generations: 0 }
    map.set(model.provider, { ...row, cost: row.cost + model.cost_brl, generations: row.generations + model.generations })
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost)
}

function FeatureTable({ data }: { readonly data: CenterData }) {
  const minMargin = data.center.settings.min_margin_rate
  return (
    <section aria-labelledby="feature-table" className="space-y-2">
      <h3 id="feature-table" className="text-sm font-bold text-zinc-200">
        Margem por funcionalidade
      </h3>
      <div className="relative overflow-x-auto card-premium rounded-2xl">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Gerações, créditos, custo real, receita estimada e margem de cada funcionalidade</caption>
          <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className={TH}>Funcionalidade</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Gerações</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Créditos</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Custo real</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Receita estimada</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Custo/geração</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Margem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {data.features.map((feature) => {
              const low = feature.margin !== null && (feature.margin < 0 || (minMargin !== null && feature.margin < minMargin))
              return (
                <tr key={feature.feature}>
                  <th scope="row" className="px-3 py-2.5 font-semibold text-zinc-100">{feature.label}</th>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{count(feature.generations)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{count(feature.credits)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-100">{moneyFromBrl(feature.costBrl)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{moneyFromBrl(feature.revenueBrl)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{moneyFromBrl(feature.costPerGenerationBrl) ?? '–'}</td>
                  <td className={clsx('px-3 py-2.5 text-right font-semibold tabular-nums', low ? 'text-red-300' : 'text-emerald-300')}>{pct(feature.margin) ?? '–'}</td>
                </tr>
              )
            })}
            {data.features.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhuma geração cobrada no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Receita estimada = créditos consumidos × valor de referência do crédito. Personagens e formatos prontos são gerações de imagem ou vídeo feitas por esses recursos.
      </p>
    </section>
  )
}

function TopUsers({ data }: { readonly data: CenterData }) {
  const value = data.center.settings.credit_value_brl
  const rows = data.center.ai.top_users
  return (
    <section aria-labelledby="top-users" className="space-y-2">
      <h3 id="top-users" className="text-sm font-bold text-zinc-200">
        Top 10 usuários com maior custo de IA
      </h3>
      <div className="relative overflow-x-auto card-premium rounded-2xl">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <caption className="sr-only">Usuários que mais custaram em IA no período</caption>
          <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className={TH}>Usuário</th>
              <th scope="col" className={TH}>Plano</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Gerações</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Créditos</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Custo real</th>
              <th scope="col" className={clsx(TH, 'text-right')}>Margem estimada</th>
              <th scope="col" className={TH}><span className="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.map((row, index) => {
              const marginBrl = row.credits * value - row.cost_brl
              return (
                <tr key={row.user_id} className="transition-colors hover:bg-white/[0.025]">
                  <th scope="row" className="max-w-64 truncate px-3 py-2.5 font-medium text-zinc-100">
                    <span className="mr-2 text-xs tabular-nums text-zinc-500">{index + 1}</span>
                    {row.email ?? 'Conta (sem acesso ao e-mail)'}
                  </th>
                  <td className="px-3 py-2.5 text-zinc-300">{row.plan_name ?? '–'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{count(row.generations)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{count(row.credits)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-100">{moneyFromBrl(row.cost_brl)}</td>
                  <td className={clsx('px-3 py-2.5 text-right font-semibold tabular-nums', marginBrl < 0 ? 'text-red-300' : 'text-zinc-200')}>{moneyFromBrl(marginBrl)}</td>
                  <td className="px-2 py-2.5">
                    {row.email && (
                      <Link
                        to={`/admin/usuarios?usuario=${row.user_id}`}
                        aria-label={`Abrir a conta de ${row.email}`}
                        className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhum consumo no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Margem estimada = créditos consumidos × {moneyFromBrl(value)} − custo real. Não considera o que a pessoa pagou de fato; para isso, abra a conta.
      </p>
    </section>
  )
}
