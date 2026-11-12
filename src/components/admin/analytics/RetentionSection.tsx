import { ratio, monthlyChurn, type Analytics, type Cohort, type DormantUser } from '@/domain/adminAnalytics'
import { FAILURE_COLOR, SERIES_COLORS } from '../charts/chartColors'
import { ColumnChart } from '../charts/ColumnChart'
import { GRID, Section } from '../dashboard/DashboardSections'
import { StatTile } from '../dashboard/StatTile'
import { DataTable, type Column } from '../finance/DataTable'
import { formatNumber, formatPercent } from '../finance/format'

const [VIOLET] = SERIES_COLORS
const weekLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo' })
const WEEKS = 8

function CohortTable({ cohorts }: { readonly cohorts: readonly Cohort[] }) {
  if (cohorts.length === 0) return <p className="card-premium rounded-2xl px-4 py-6 text-sm text-zinc-500">Sem cadastros nas últimas oito semanas.</p>
  return (
    <div role="region" aria-label="Coortes semanais" tabIndex={0} className="relative overflow-x-auto rounded-2xl ring-1 ring-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Porcentagem de cada turma de cadastro que usou o Vynkio em cada semana seguinte</caption>
        <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left font-semibold">Semana do cadastro</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pessoas</th>
            {Array.from({ length: WEEKS }, (_, week) => (
              <th key={week} scope="col" className="px-2 py-2.5 text-center font-semibold">
                S{week}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {cohorts.map((cohort) => (
            <tr key={cohort.week_start}>
              <th scope="row" className="px-3 py-2 text-left font-semibold text-zinc-200">
                {weekLabel.format(new Date(cohort.week_start))}
              </th>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{formatNumber(cohort.size)}</td>
              {Array.from({ length: WEEKS }, (_, week) => {
                const active = cohort.weeks[week]
                if (active === undefined) return <td key={week} className="px-2 py-2" aria-label="Ainda não chegou" />
                const share = ratio(active, cohort.size) ?? 0
                return (
                  <td key={week} className="px-1 py-1 text-center">
                    <span
                      className="block rounded-md px-1 py-1.5 text-xs tabular-nums text-zinc-100"
                      style={{ backgroundColor: `rgba(139, 92, 246, ${0.08 + share * 0.72})` }}
                      title={`${formatNumber(active)} de ${formatNumber(cohort.size)}`}
                    >
                      {formatPercent(share)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DORMANT_COLUMNS: readonly Column<DormantUser>[] = [
  { key: 'email', label: 'Conta', render: (row) => row.email ?? row.user_id.slice(0, 8) },
  { key: 'plan', label: 'Plano', render: (row) => row.plan_slug },
  { key: 'last', label: 'Último uso', render: (row) => dateTime.format(new Date(row.last_activity_at)) },
  { key: 'login', label: 'Último login', render: (row) => (row.last_sign_in_at ? dateTime.format(new Date(row.last_sign_in_at)) : '–') },
  { key: 'actions', label: 'Usos no total', align: 'right', render: (row) => formatNumber(row.actions) },
  { key: 'balance', label: 'Saldo', align: 'right', render: (row) => formatNumber(row.balance) },
]

/** Retenção: quem volta, quanto tempo fica e quem parou. */
export function RetentionSection({ data, stale }: { readonly data: Analytics; readonly stale: boolean }) {
  const { retention } = data
  const { activation } = retention
  const stickiness = ratio(retention.dau, retention.mau)
  return (
    <div className="space-y-8">
      <Section title="Uso agora" description="Ativo = gerou algo ou exportou no Multiplicador. Login sozinho aparece à parte.">
        <div className={GRID}>
          <StatTile label="Ativos hoje (24h)" value={formatNumber(retention.dau)} hint={`${formatNumber(retention.wau)} na semana`} />
          <StatTile label="Ativos no mês (30d)" value={formatNumber(retention.mau)} hint={`de ${formatNumber(retention.total_users)} contas`} />
          <StatTile label="Fidelidade (DAU/MAU)" value={formatPercent(stickiness)} hint="quanto do mês volta todo dia" />
          <StatTile label="Entraram sem usar (30d)" value={formatNumber(Math.max(0, retention.logins_30d - retention.mau))} hint={`${formatNumber(retention.logins_30d)} logins no mês`} />
        </div>
      </Section>

      <Section title="Quem se cadastrou no período" description="Voltou = usou de novo na janela: D1 de 24h a 48h, D7 de 7 a 14 dias, D30 de 30 a 60 dias.">
        <div className={GRID}>
          <StatTile label="Cadastros" value={formatNumber(activation.signed_up)} />
          <StatTile label="Ativou (usou alguma vez)" value={formatPercent(ratio(activation.activated, activation.signed_up))} hint={`${formatPercent(ratio(activation.activated_24h, activation.signed_up))} no primeiro dia`} />
          {retention.returning.map((row) => (
            <StatTile
              key={row.day}
              label={`Voltou no D${row.day}`}
              value={formatPercent(ratio(row.returned, row.eligible))}
              hint={row.eligible > 0 ? `${formatNumber(row.returned)} de ${formatNumber(row.eligible)}` : 'ninguém chegou lá ainda'}
            />
          ))}
        </div>
      </Section>

      <Section title="Coortes semanais" description="Cada linha é uma turma de cadastro; S0 é a semana do cadastro, S1 a seguinte. A cor acompanha a porcentagem que usou.">
        <CohortTable cohorts={retention.cohorts} />
      </Section>

      <Section title="Assinaturas mês a mês" description="Churn = canceladas no mês sobre as vivas no começo do mês.">
        <ColumnChart
          title="Assinaturas novas e cancelamentos"
          integer
          stale={stale}
          format={formatNumber}
          series={[
            { key: 'new', label: 'Novas', color: VIOLET },
            { key: 'canceled', label: 'Canceladas', color: FAILURE_COLOR },
          ]}
          points={retention.subscriptions.map((month) => ({ day: `${month.month}-01`, values: { new: month.new, canceled: month.canceled } }))}
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {retention.subscriptions.map((month) => (
            <li key={month.month} className="card-premium rounded-2xl p-3 text-sm">
              <p className="text-[12px] font-semibold text-zinc-400">{month.month}</p>
              <p className="mt-1 font-semibold text-zinc-100">Churn {formatPercent(monthlyChurn(month))}</p>
              <p className="text-xs text-zinc-500">{formatNumber(month.live_at_start)} vivas no dia 1</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Pararam de usar (${formatNumber(retention.dormant_count)})`} description="Já usaram, mas nada nos últimos 14 dias. Pagantes primeiro: é quem dá para recuperar.">
        {retention.dormant === null ? (
          <p className="card-premium rounded-2xl px-4 py-6 text-sm text-zinc-500">Sua permissão não mostra contas individuais.</p>
        ) : (
          <DataTable caption="Contas paradas" rows={retention.dormant} columns={DORMANT_COLUMNS} rowKey={(row) => row.user_id} empty="Ninguém parado: todo mundo que usou voltou nos últimos 14 dias." />
        )}
      </Section>
    </div>
  )
}
