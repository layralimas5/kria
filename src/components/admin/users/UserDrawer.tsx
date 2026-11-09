import clsx from 'clsx'
import { useCallback, useState, type ReactNode } from 'react'
import { LEDGER_REASON_LABELS } from '@/domain/adminAnalytics'
import { ADMIN_ACTION_LABELS, displayName, type UserProfile } from '@/domain/adminUsers'
import { formatBRL, formatDateTime } from '@/domain/format'
import { STATUS_LABELS } from '@/domain/plans'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { fetchUserProfile } from '@/lib/adminApi'
import { Drawer } from '../../ui/Drawer'
import { Notice } from '../../ui/Notice'
import { formatBrlValue, formatNumber } from '../finance/format'
import { AdminAvatar } from '../ProfileMenu'
import { AdjustCreditsForm, PlanGrantForm, SuspendForm } from './UserActions'

const TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'geracoes', label: 'Gerações' },
  { id: 'creditos', label: 'Créditos' },
  { id: 'assinatura', label: 'Plano e assinatura' },
  { id: 'acoes', label: 'Ações' },
] as const
type TabId = (typeof TABS)[number]['id']

const statusLabel = (status: string) => STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status
const BASIS_LABELS: Readonly<Record<string, string>> = { metered: 'medido', estimated: 'estimado', unknown: 'sem tarifa' }

function Facts({ items }: { readonly items: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
          <dt className="text-xs text-zinc-500">{label}</dt>
          <dd className="mt-0.5 truncate font-semibold text-zinc-100">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Block({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h3 className="text-sm font-bold text-zinc-200">{title}</h3>
      {children}
    </section>
  )
}

function Rows({ empty, children }: { readonly empty: string; readonly children: ReactNode[] }) {
  return (
    <ul className="divide-y divide-white/[0.05] rounded-2xl bg-surface-2 text-sm">
      {children.length === 0 ? <li className="px-3 py-6 text-center text-zinc-500">{empty}</li> : children}
    </ul>
  )
}

function Summary({ profile }: { readonly profile: UserProfile }) {
  const { account, activity, ai_cost: cost } = profile
  return (
    <div className="space-y-6">
      <Facts
        items={[
          ['Plano atual', profile.plan.name + (profile.grant ? ' (cortesia)' : '')],
          ['Saldo', `${formatNumber(account.balance)} créditos`],
          ['Créditos consumidos', formatNumber(profile.credits.consumed)],
          ['Cadastro', formatDateTime(account.created_at)],
          ['Último acesso', account.last_sign_in_at ? formatDateTime(account.last_sign_in_at) : 'nunca entrou'],
          ['E-mail confirmado', account.email_confirmed ? 'sim' : 'não'],
          ['Dias ativos (30d)', formatNumber(activity.active_days_30d)],
          ['Gerações (30d)', formatNumber(activity.generations_30d)],
          ['Última geração', activity.last_generation_at ? formatDateTime(activity.last_generation_at) : '–'],
        ]}
      />
      {account.created_by_admin_email && <p className="text-xs text-zinc-500">Conta criada no admin por {account.created_by_admin_email}.</p>}
      <Block title="Custo de IA atribuído">
        {cost === null ? (
          <p className="text-sm text-zinc-500">Custos ficam com quem tem acesso ao financeiro.</p>
        ) : (
          <Facts
            items={[
              ['Total', formatBrlValue(cost.total_brl)],
              ['Últimos 30 dias', formatBrlValue(cost.last_30d_brl)],
              ['Base', `${cost.metered} medidas · ${cost.estimated} estimadas${cost.unknown ? ` · ${cost.unknown} sem tarifa` : ''}`],
            ]}
          />
        )}
      </Block>
      <Block title="Modelos mais usados">
        <Rows empty="Nenhuma geração ainda.">
          {profile.top_models.map((model) => (
            <li key={model.model_slug} className="flex justify-between gap-3 px-3 py-2">
              <span className="truncate text-zinc-200">{model.name ?? model.model_slug}</span>
              <span className="shrink-0 tabular-nums text-zinc-400">
                {formatNumber(model.total)} usos · {formatNumber(model.credits)} cr
              </span>
            </li>
          ))}
        </Rows>
      </Block>
    </div>
  )
}

function Generations({ profile }: { readonly profile: UserProfile }) {
  return (
    <Rows empty="Nenhuma geração.">
      {profile.generations.map((generation) => (
        <li key={generation.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-zinc-200">{generation.model_name ?? generation.model_slug}</span>
            <span className="block text-xs text-zinc-500">
              {formatDateTime(generation.created_at)} · {generation.status}
              {generation.error && ` · ${generation.error}`}
            </span>
          </span>
          <span className="shrink-0 text-right tabular-nums">
            <span className="block text-zinc-300">{generation.credits} cr</span>
            {generation.cost_brl !== null && (
              <span className="block text-xs text-zinc-500">
                {formatBrlValue(generation.cost_brl)} {generation.cost_basis && `· ${BASIS_LABELS[generation.cost_basis] ?? generation.cost_basis}`}
              </span>
            )}
          </span>
        </li>
      ))}
    </Rows>
  )
}

function Credits({ profile, onChanged }: { readonly profile: UserProfile; readonly onChanged: () => void }) {
  const { can } = useAdminAccess()
  const received = Object.entries(profile.credits.received)
  return (
    <div className="space-y-6">
      <Facts
        items={[
          ['Saldo do plano', formatNumber(profile.account.subscription_balance)],
          ['Saldo avulso', formatNumber(profile.account.purchased_balance)],
          ['Estornado por falha', formatNumber(profile.credits.refunded)],
          ...received.map(([reason, total]) => [`Recebido: ${LEDGER_REASON_LABELS[reason] ?? reason}`, formatNumber(total)] as const),
        ]}
      />
      {can('credits.adjust') && (
        <Block title="Adicionar ou remover créditos">
          <AdjustCreditsForm user={{ id: profile.account.id, email: profile.account.email, suspended_at: profile.account.suspended_at }} onDone={onChanged} />
        </Block>
      )}
      <Block title="Extrato">
        <Rows empty="Sem movimentos.">
          {profile.ledger.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-zinc-300">
                  {LEDGER_REASON_LABELS[entry.reason] ?? entry.reason}
                  {entry.note && <span className="text-zinc-500"> · {entry.note}</span>}
                </span>
                <span className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</span>
              </span>
              <span className={clsx('shrink-0 tabular-nums', entry.delta > 0 ? 'text-accent-soft' : 'text-zinc-400')}>
                {entry.delta > 0 ? '+' : ''}
                {entry.delta}
              </span>
            </li>
          ))}
        </Rows>
      </Block>
    </div>
  )
}

function Plan({ profile, plans, onChanged }: { readonly profile: UserProfile; readonly plans: readonly { slug: string; name: string }[]; readonly onChanged: () => void }) {
  const { can } = useAdminAccess()
  return (
    <div className="space-y-6">
      {can('users.manage') && (
        <Block title="Alterar plano (cortesia)">
          <PlanGrantForm
            user={{ id: profile.account.id, email: profile.account.email, suspended_at: profile.account.suspended_at }}
            plans={plans}
            grant={profile.grant}
            onDone={onChanged}
          />
        </Block>
      )}
      <Block title="Histórico de assinatura">
        <Rows empty="Nunca assinou.">
          {profile.subscriptions.map((subscription) => (
            <li key={subscription.id} className="flex justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold text-zinc-200">
                  {subscription.plan_slug} · {statusLabel(subscription.status)}
                </span>
                <span className="text-xs text-zinc-500">
                  desde {formatDateTime(subscription.created_at)}
                  {subscription.current_period_end && ` · ciclo até ${formatDateTime(subscription.current_period_end)}`}
                  {subscription.canceled_at && ` · cancelada em ${formatDateTime(subscription.canceled_at)}`}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-zinc-300">{formatBRL(subscription.price_cents)}</span>
            </li>
          ))}
        </Rows>
      </Block>
      <Block title="Pagamentos">
        {profile.payments === null ? (
          <p className="text-sm text-zinc-500">Pagamentos ficam com quem tem acesso ao financeiro.</p>
        ) : (
          <Rows empty="Nenhum pagamento.">
            {profile.payments.map((payment, index) => (
              <li key={`${payment.at}-${index}`} className="flex justify-between gap-3 px-3 py-2">
                <span className="text-zinc-300">
                  {payment.type === 'subscription' ? 'Mensalidade' : 'Pacote'} · {payment.status}
                  <span className="block text-xs text-zinc-500">{formatDateTime(payment.at)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-zinc-300">{formatBRL(payment.amount_cents)}</span>
              </li>
            ))}
          </Rows>
        )}
      </Block>
    </div>
  )
}

function Actions({ profile, onChanged }: { readonly profile: UserProfile; readonly onChanged: () => void }) {
  const { can } = useAdminAccess()
  return (
    <div className="space-y-6">
      {can('users.manage') && (
        <Block title={profile.account.suspended_at ? 'Reativar conta' : 'Bloquear conta'}>
          {profile.account.suspended_at && (
            <Notice tone="error">
              Bloqueada desde {formatDateTime(profile.account.suspended_at)}
              {profile.account.suspended_reason && `: ${profile.account.suspended_reason}`}
            </Notice>
          )}
          <SuspendForm user={{ id: profile.account.id, email: profile.account.email, suspended_at: profile.account.suspended_at }} onDone={onChanged} />
        </Block>
      )}
      <Block title="Histórico de ações administrativas">
        {profile.admin_actions === null ? (
          <p className="text-sm text-zinc-500">A auditoria fica com quem tem acesso a ela.</p>
        ) : (
          <Rows empty="Nenhuma ação administrativa nesta conta.">
            {profile.admin_actions.map((entry) => (
              <li key={entry.id} className="px-3 py-2.5">
                <p className="font-semibold text-zinc-200">{ADMIN_ACTION_LABELS[entry.action] ?? entry.action}</p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(entry.created_at)} · {entry.admin_email ?? 'admin removido'}
                  {entry.reason && ` · ${entry.reason}`}
                </p>
              </li>
            ))}
          </Rows>
        )}
      </Block>
    </div>
  )
}

interface UserDrawerProps {
  readonly userId: string | null
  readonly plans: readonly { slug: string; name: string }[]
  readonly onClose: () => void
  readonly onChanged: () => void
}

/** Perfil completo da conta, com as ações sensíveis atrás de confirmação e auditoria. */
export function UserDrawer({ userId, plans, onClose, onChanged }: UserDrawerProps) {
  const [tab, setTab] = useState<TabId>('resumo')
  const load = useCallback(() => (userId ? fetchUserProfile(userId) : Promise.resolve(null)), [userId])
  const profile = useQuery(load, 'Não deu para carregar a conta.')
  const data = profile.data
  const refresh = () => {
    void profile.reload()
    onChanged()
  }
  const name = data ? displayName(data.account) : ''

  return (
    <Drawer open={userId !== null} title={name || 'Conta'} description={data?.account.email ?? undefined} onClose={onClose} size="lg">
      {profile.error && <Notice tone="error">{profile.error}</Notice>}
      {!data && !profile.error && (
        <div className="space-y-3" role="status" aria-label="Carregando conta">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      )}
      {data && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <AdminAvatar name={name} path={data.account.avatar_path} className="size-12" />
            <div className="min-w-0 text-sm">
              <p className="truncate text-zinc-400">@{data.account.username}</p>
              <p className={clsx('font-semibold', data.account.suspended_at ? 'text-red-300' : 'text-emerald-300')}>
                {data.account.suspended_at ? 'Bloqueada' : 'Ativa'}
              </p>
            </div>
          </div>
          <div role="tablist" aria-label="Seções da conta" className="flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1 ring-1 ring-white/[0.06] [scrollbar-width:none]">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={clsx(
                  'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  tab === item.id ? 'bg-white/[0.08] text-zinc-50' : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={TABS.find((item) => item.id === tab)?.label}>
            {tab === 'resumo' && <Summary profile={data} />}
            {tab === 'geracoes' && <Generations profile={data} />}
            {tab === 'creditos' && <Credits profile={data} onChanged={refresh} />}
            {tab === 'assinatura' && <Plan profile={data} plans={plans} onChanged={refresh} />}
            {tab === 'acoes' && <Actions profile={data} onChanged={refresh} />}
          </div>
        </div>
      )}
    </Drawer>
  )
}
