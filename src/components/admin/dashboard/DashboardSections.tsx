import { CircleAlert, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { averageTicket, change, contribution, ratio, type Dashboard, type DashboardAlert, type DashboardFinance } from '@/domain/adminDashboard'
import { formatBRL } from '@/domain/format'
import { BarList } from '../charts/BarList'
import { FAILURE_COLOR, SERIES_COLORS } from '../charts/chartColors'
import { ColumnChart } from '../charts/ColumnChart'
import { StatTile } from './StatTile'

const [VIOLET, GOLD, SKY, PINK] = SERIES_COLORS
const number = (value: number) => value.toLocaleString('pt-BR')
const compact = (value: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const percent = (value: number | null) => (value === null ? '–' : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const usd = (value: number) => `US$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brlCompact = (cents: number) => `R$ ${compact(cents / 100)}`

function Section({ title, description, children }: { readonly title: string; readonly description?: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div>
        <h2 className="font-headline text-lg text-zinc-100">{title}</h2>
        {description && <p className="text-xs text-zinc-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const GRID = 'grid grid-cols-2 gap-3 xl:grid-cols-4'
const generationsLabel = (count: number) => `${number(count)} ${count === 1 ? 'geração' : 'gerações'}`

export function AlertsList({ alerts }: { readonly alerts: readonly DashboardAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <section aria-label="Alertas" className="space-y-2">
      {alerts.map((alert) => {
        const critical = alert.severity === 'critical'
        const Icon = critical ? CircleAlert : TriangleAlert
        return (
          <div key={alert.id} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-surface px-4 py-3">
            <Icon className={critical ? 'mt-0.5 size-4 shrink-0 text-red-300' : 'mt-0.5 size-4 shrink-0 text-hot'} aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-zinc-100">
                <span className="sr-only">{critical ? 'Crítico: ' : 'Atenção: '}</span>
                {alert.title}
              </p>
              <p className="text-zinc-400">{alert.detail}</p>
            </div>
          </div>
        )
      })}
    </section>
  )
}

export function UsersSection({ data }: { readonly data: Dashboard }) {
  const users = data.users
  return (
    <Section title="Usuários" description="Ativo = gerou alguma coisa (foto, vídeo ou texto). Login sozinho não conta.">
      <div className={GRID}>
        <StatTile label="Cadastrados" value={number(users.total)} hint={`${number(users.new_today)} hoje · ${number(users.new_7d)} em 7 dias · ${number(users.new_30d)} em 30`} />
        <StatTile label="Novos no período" value={number(users.new_in_period)} change={change(users.new_in_period, users.new_previous)} />
        <StatTile label="Ativos (24h / 30 dias)" value={`${number(users.active_1d)} / ${number(users.active_30d)}`} hint={`${number(users.active_in_period)} no período`} />
        <StatTile label="Pagantes / gratuitos" value={`${number(users.paying)} / ${number(Math.max(0, users.total - users.paying))}`} hint="Pagante = plano valendo agora" />
      </div>
    </Section>
  )
}

export function RevenueSection({ finance }: { readonly finance: DashboardFinance }) {
  const ticket = averageTicket(finance)
  const churn = ratio(finance.churn_lost, finance.churn_base)
  return (
    <Section title="Receita" description="Recorrente (MRR) é o contratado; recebido é o que o Asaas confirmou. Nenhum dos dois é lucro.">
      <div className={GRID}>
        <StatTile label="MRR" value={formatBRL(finance.mrr_cents)} hint={`ARR ${formatBRL(finance.mrr_cents * 12)}`} />
        <StatTile
          label="Recebido no período"
          value={formatBRL(finance.received_cents)}
          change={change(finance.received_cents, finance.received_previous_cents)}
          hint={`Planos ${formatBRL(finance.subscription_received_cents)} · pacotes ${formatBRL(finance.pack_received_cents)}`}
        />
        <StatTile label="Recebido acumulado" value={formatBRL(finance.received_total_cents)} hint={finance.refunds_cents > 0 ? `${formatBRL(finance.refunds_cents)} reembolsados no período` : 'Desde o início'} />
        <StatTile label="Ticket médio" value={ticket === null ? '–' : formatBRL(ticket)} hint={`${number(finance.payments_count)} pagamentos no período`} />
        <StatTile label="Novas assinaturas" value={number(finance.new_subscriptions)} />
        <StatTile
          label="Cancelamentos"
          value={number(finance.cancellations)}
          change={change(finance.cancellations, finance.cancellations_previous)}
          upIsGood={false}
          hint={finance.past_due > 0 ? `${finance.past_due} em atraso` : undefined}
        />
        <StatTile
          label="Churn de clientes"
          value={percent(churn)}
          hint={finance.churn_base > 0 ? `${finance.churn_lost} de ${finance.churn_base} assinantes do início do período` : 'Sem assinante pagante no início do período'}
        />
      </div>
    </Section>
  )
}

export function AiSection({ data }: { readonly data: Dashboard }) {
  const generations = data.generations
  const finance = data.finance
  const failRate = ratio(generations.failed, generations.total)
  const margin = finance ? contribution(finance) : null
  const costPerGeneration = finance && generations.succeeded > 0 ? finance.api_cost_usd / generations.succeeded : null
  return (
    <Section title="Inteligência artificial" description="Custo de API é estimado pelo custo cadastrado do modelo no momento da geração.">
      <div className={GRID}>
        <StatTile label="Gerações hoje / no mês" value={`${number(generations.today)} / ${number(generations.month)}`} />
        <StatTile
          label="Gerações no período"
          value={number(generations.total)}
          change={change(generations.total, generations.previous_total)}
          hint={`${number(generations.image)} imagens · ${number(generations.video)} vídeos · ${number(generations.text)} textos`}
        />
        <StatTile
          label="Falhas"
          value={number(generations.failed)}
          change={change(generations.failed, generations.previous_failed)}
          upIsGood={false}
          tone={failRate !== null && failRate >= 0.1 ? 'bad' : undefined}
          hint={`${percent(failRate)} das gerações${generations.open > 0 ? ` · ${generations.open} abertas` : ''}`}
        />
        <StatTile label="Créditos consumidos" value={number(generations.credits_consumed)} hint="Só gerações concluídas (falha estorna)" />
        {finance && margin && (
          <>
            <StatTile
              label="Custo das APIs"
              value={usd(finance.api_cost_usd)}
              change={change(finance.api_cost_usd, finance.api_cost_previous_usd)}
              upIsGood={false}
              hint={
                finance.api_cost_unknown > 0
                  ? `≈ ${formatBRL(margin.apiCostCents)} · ${generationsLabel(finance.api_cost_unknown)} sem custo cadastrado`
                  : `≈ ${formatBRL(margin.apiCostCents)} · ${costPerGeneration === null ? 'sem geração concluída' : `${usd(costPerGeneration)} por geração`}`
              }
              tone={finance.api_cost_unknown > 0 ? 'bad' : undefined}
            />
            <StatTile
              label="Margem de contribuição"
              value={formatBRL(margin.marginCents)}
              tone={margin.marginCents < 0 ? 'bad' : margin.receivedCents > 0 ? 'good' : undefined}
              hint={`${percent(margin.marginRate)} do recebido · estimada, sem custos fixos e impostos`}
            />
          </>
        )}
      </div>
    </Section>
  )
}

export function ChartsSection({ data, stale }: { readonly data: Dashboard; readonly stale: boolean }) {
  const points = (pick: (point: Dashboard['series'][number]) => Record<string, number>) => data.series.map((point) => ({ day: point.day, values: pick(point) }))
  return (
    <Section title="Evolução no período">
      <div className="grid gap-3 lg:grid-cols-2">
        <ColumnChart title="Cadastros por dia" series={[{ key: 'signups', label: 'Cadastros', color: VIOLET }]} points={points((p) => ({ signups: p.signups }))} format={compact} stale={stale} integer />
        <ColumnChart
          title="Gerações por dia"
          series={[
            { key: 'succeeded', label: 'Concluídas', color: VIOLET },
            { key: 'failed', label: 'Falharam', color: FAILURE_COLOR },
          ]}
          points={points((p) => ({ succeeded: p.succeeded, failed: p.failed }))}
          format={compact}
          stale={stale}
          integer
        />
        <ColumnChart title="Créditos consumidos por dia" series={[{ key: 'credits', label: 'Créditos', color: SKY }]} points={points((p) => ({ credits: p.credits }))} format={compact} stale={stale} integer />
        <ColumnChart
          title="Assinaturas por dia"
          series={[
            { key: 'new', label: 'Novas', color: VIOLET },
            { key: 'canceled', label: 'Canceladas', color: PINK },
          ]}
          points={points((p) => ({ new: p.new_subscriptions, canceled: p.cancellations }))}
          format={compact}
          stale={stale}
          integer
        />
        {data.finance && (
          <>
            <ColumnChart title="Receita recebida por dia" series={[{ key: 'revenue', label: 'Recebido', color: GOLD }]} points={points((p) => ({ revenue: p.revenue_cents ?? 0 }))} format={brlCompact} stale={stale} />
            <ColumnChart title="Custo de API por dia (US$)" series={[{ key: 'cost', label: 'Custo', color: PINK }]} points={points((p) => ({ cost: p.api_cost_usd ?? 0 }))} format={(value) => usd(value)} stale={stale} />
          </>
        )}
      </div>
    </Section>
  )
}

export function BreakdownSection({ data }: { readonly data: Dashboard }) {
  const users = data.users
  const funnel = [
    { key: 'signup', label: 'Cadastros no período', value: users.new_in_period },
    { key: 'onboarded', label: 'Concluíram o onboarding', value: users.onboarded_in_period },
    { key: 'first', label: 'Fizeram a primeira geração', value: users.first_generation_in_period },
    { key: 'paid', label: 'Pagaram (plano ou pacote)', value: users.converted_in_period },
  ].map((step) => ({ ...step, display: `${number(step.value)} · ${percent(ratio(step.value, users.new_in_period))}` }))

  return (
    <Section title="Onde está o uso e o dinheiro">
      <div className="grid gap-3 lg:grid-cols-2">
        <BarList title="Ativação de quem se cadastrou no período" rows={funnel} color={VIOLET} emptyText="Nenhum cadastro no período." />
        <BarList
          title="Usuários por plano (agora)"
          rows={data.plan_distribution.map((plan) => ({ key: plan.slug, label: plan.name, value: plan.users }))}
          color={GOLD}
          emptyText="Nenhum usuário ainda."
        />
        <BarList
          title="Uso por modelo"
          rows={data.by_model.map((model) => ({
            key: model.model_slug,
            label: model.name,
            value: model.total,
            display: generationsLabel(model.total),
            detail: `${model.provider} · ${number(model.failed)} falhas (${percent(ratio(model.failed, model.total))}) · ${number(model.credits)} créditos${model.cost_usd === null ? '' : ` · ${usd(model.cost_usd)}`}`,
          }))}
          color={SKY}
          emptyText="Nenhuma geração no período."
        />
        {data.finance && (
          <BarList
            title="Receita por plano no período"
            rows={data.finance.by_plan.map((plan) => ({
              key: plan.slug,
              label: plan.name,
              value: plan.received_cents,
              display: formatBRL(plan.received_cents),
              detail: `${number(plan.subscribers)} assinantes · MRR ${formatBRL(plan.mrr_cents)}`,
            }))}
            color={GOLD}
            emptyText="Nenhum pagamento de plano no período."
          />
        )}
        {data.top_consumers && (
          <BarList
            title="Quem mais consumiu créditos"
            rows={data.top_consumers.map((consumer) => ({
              key: consumer.user_id,
              label: consumer.email ?? consumer.user_id,
              value: consumer.credits,
              display: `${number(consumer.credits)} créditos`,
              detail: `${generationsLabel(consumer.generations)} concluídas`,
            }))}
            color={PINK}
            emptyText="Nenhum consumo no período."
          />
        )}
      </div>
    </Section>
  )
}

export function Definitions() {
  return (
    <details className="rounded-2xl bg-surface px-4 py-3 text-sm ring-1 ring-white/[0.06]">
      <summary className="cursor-pointer font-semibold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Como cada número é calculado</summary>
      <dl className="mt-3 grid gap-3 text-zinc-400 sm:grid-cols-2">
        <div><dt className="font-semibold text-zinc-200">Período</dt><dd>Dias inteiros no horário de Brasília; a variação compara com o período anterior de mesmo tamanho.</dd></div>
        <div><dt className="font-semibold text-zinc-200">MRR e ARR</dt><dd>Soma do preço contratado das assinaturas ativas e em atraso. ARR = MRR × 12. Cancelada não entra, mesmo ainda valendo.</dd></div>
        <div><dt className="font-semibold text-zinc-200">Recebido</dt><dd>Mensalidades confirmadas pelo Asaas mais pacotes pagos, na data do pagamento. Reembolso sai do recebido e aparece à parte.</dd></div>
        <div><dt className="font-semibold text-zinc-200">Churn</dt><dd>Assinaturas pagas que cancelaram ou expiraram sem renovar no período, sobre as que estavam pagas no início dele. Troca de plano não conta.</dd></div>
        <div><dt className="font-semibold text-zinc-200">Custo de API</dt><dd>Custo do fornecedor cadastrado no modelo quando a geração nasceu, só das concluídas. É estimativa até conciliar com a fatura do fal e da Anthropic.</dd></div>
        <div><dt className="font-semibold text-zinc-200">Margem de contribuição</dt><dd>Recebido menos a taxa estimada do gateway e o custo de API. Não desconta custos fixos, impostos nem armazenamento: não é lucro.</dd></div>
        <div><dt className="font-semibold text-zinc-200">Ativo</dt><dd>Conta que gerou pelo menos uma foto, vídeo ou texto na janela (24 horas, 30 dias ou o período).</dd></div>
        <div><dt className="font-semibold text-zinc-200">Ativação</dt><dd>Das contas criadas no período: quantas concluíram o onboarding, geraram algo e pagaram alguma vez até agora.</dd></div>
      </dl>
    </details>
  )
}
