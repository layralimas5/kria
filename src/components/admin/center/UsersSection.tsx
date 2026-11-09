import { ratio } from '@/domain/adminDashboard'
import type { CenterData } from '@/domain/commandCenter'
import { BarList } from '../charts/BarList'
import { SERIES_COLORS } from '../charts/chartColors'
import { CohortGrid } from '../charts/CohortGrid'
import { LineChart } from '../charts/LineChart'
import { CenterSection } from './CenterLayout'
import { count, pct } from './format'
import { MetricCard, MetricGrid } from './MetricCard'

const [VIOLET, GOLD, SKY] = SERIES_COLORS

/** Aquisição, ativação, engajamento e retenção. Ativo = gerou alguma coisa; login sozinho não conta. */
export function UsersSection({ data }: { readonly data: CenterData }) {
  const { center, dashboard } = data
  const people = center.users
  const signupsByDay = new Map(dashboard.series.map((day) => [day.day, day.signups]))
  const funnel = [
    { key: 'signup', label: 'Cadastraram-se', value: dashboard.users.new_in_period },
    { key: 'onboarded', label: 'Concluíram o onboarding', value: dashboard.users.onboarded_in_period },
    { key: 'first', label: 'Fizeram a primeira geração', value: dashboard.users.first_generation_in_period },
    { key: 'paid', label: 'Pagaram (plano ou pacote)', value: dashboard.users.converted_in_period },
  ]

  return (
    <CenterSection id="usuarios" title="Usuários" question="Quem chega, quem usa, quem volta e quem está para esbarrar no limite.">
      <MetricGrid>
        <MetricCard label="Ativos hoje (DAU)" value={count(people.dau)} info="Contas que geraram algo hoje (desde 0h de Brasília)." to="/admin/usuarios" />
        <MetricCard
          label="Ativos no mês (MAU)"
          value={count(people.mau)}
          hint={`Engajamento DAU/MAU ${pct(ratio(people.dau, people.mau)) ?? '–'}`}
          info="Contas que geraram algo nos últimos 30 dias. DAU ÷ MAU mostra quantos voltam todo dia."
          spark={people.active_series.map((day) => day.users)}
        />
        <MetricCard
          label="Novos cadastros"
          value={count(dashboard.users.new_in_period)}
          info="Contas criadas no período."
          spark={dashboard.series.map((day) => day.signups)}
          sparkColor={GOLD}
        />
        <MetricCard
          label="Média de gerações por ativo"
          value={people.active_period > 0 ? (people.generations_period / people.active_period).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : null}
          info="Gerações pedidas no período ÷ contas que geraram algo no período."
        />
        <MetricCard
          label="Usaram IA"
          value={count(people.used_ai)}
          hint={`${pct(ratio(people.used_ai, people.used_ai + people.never_used)) ?? '–'} das contas`}
          info="Contas com pelo menos uma geração desde sempre."
        />
        <MetricCard
          label="Nunca usaram"
          value={count(people.never_used)}
          tone={people.never_used > people.used_ai ? 'bad' : undefined}
          info="Contas que se cadastraram e nunca pediram nenhuma geração. Bom público para e-mail de ativação."
          to="/admin/usuarios"
        />
        <MetricCard
          label="Perto do limite de créditos"
          value={count(people.near_limit)}
          info="Saldo maior que zero e abaixo de 20% dos créditos mensais do plano (mínimo de 20 créditos). Candidatos a upgrade ou pacote."
        />
        <MetricCard
          label="Créditos esgotados"
          value={count(people.exhausted)}
          tone={people.exhausted > 0 ? 'bad' : undefined}
          info="Contas com saldo zero que já usaram a plataforma: estão travadas até recarregar ou renovar."
        />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <LineChart
          title="Evolução de usuários ativos"
          series={[
            { key: 'active', label: 'Ativos no dia', color: VIOLET },
            { key: 'signups', label: 'Cadastros', color: GOLD },
          ]}
          points={people.active_series.map((day) => ({ key: day.day, values: { active: day.users, signups: signupsByDay.get(day.day) ?? 0 } }))}
          format={count}
          area
        />
        <BarList
          title="Funil de conversão de quem se cadastrou no período"
          color={VIOLET}
          emptyText="Nenhum cadastro no período."
          rows={funnel.map((step) => ({ ...step, display: `${count(step.value)} · ${pct(ratio(step.value, dashboard.users.new_in_period)) ?? '–'}` }))}
        />
        <CohortGrid rows={people.cohorts} />
        <BarList
          title="Recursos mais utilizados"
          color={SKY}
          emptyText="Nenhuma geração no período."
          rows={[...dashboard.by_model]
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)
            .map((model) => ({
              key: model.model_slug,
              label: model.name,
              value: model.total,
              display: `${count(model.total)} usos`,
              detail: `${count(model.failed)} falhas · ${count(model.credits)} créditos`,
            }))}
        />
      </div>
    </CenterSection>
  )
}
