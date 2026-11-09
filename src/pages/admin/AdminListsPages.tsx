import clsx from 'clsx'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DataTable, type Column } from '@/components/admin/finance/DataTable'
import { formatNumber, formatUsd } from '@/components/admin/finance/format'
import { EmailSearch, Pager } from '@/components/admin/lists/ListControls'
import { Notice } from '@/components/ui/Notice'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { GENERATION_STATUS_LABELS, type AdminGeneration, type AdminSubscription } from '@/domain/adminLists'
import { formatBRL } from '@/domain/format'
import { STATUS_LABELS } from '@/domain/plans'
import { useQuery } from '@/hooks/useQuery'
import { fetchAdminModels, fetchGenerations, fetchSubscriptions } from '@/lib/adminApi'

const ALL = 'all'
const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo' })
const when = (iso: string | null, format = dateTime) => (iso ? format.format(new Date(iso)) : '–')

function Page({ title, description, children }: { readonly title: string; readonly description: string; readonly children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  )
}

function Loading() {
  return (
    <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

function StatusPill({ tone, children }: { readonly tone: 'good' | 'bad' | 'warn' | 'muted'; readonly children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        tone === 'good' && 'bg-emerald-500/10 text-emerald-300',
        tone === 'bad' && 'bg-red-500/10 text-red-300',
        tone === 'warn' && 'bg-amber-500/10 text-amber-300',
        tone === 'muted' && 'bg-white/[0.06] text-zinc-400',
      )}
    >
      {children}
    </span>
  )
}

const GENERATION_TONE = { succeeded: 'good', failed: 'bad', running: 'warn', queued: 'muted' } as const

function generationColumns(showCost: boolean): Column<AdminGeneration>[] {
  const columns: Column<AdminGeneration>[] = [
    { key: 'when', label: 'Quando', render: (row) => when(row.created_at) },
    { key: 'email', label: 'Conta', render: (row) => row.email ?? row.user_id.slice(0, 8) },
    { key: 'tool', label: 'Ferramenta', render: (row) => row.model_name },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className="space-y-1">
          <StatusPill tone={GENERATION_TONE[row.status]}>{GENERATION_STATUS_LABELS[row.status]}</StatusPill>
          {row.error && <span className="block max-w-xs truncate text-xs text-zinc-500" title={row.error}>{row.error}</span>}
        </span>
      ),
    },
    { key: 'prompt', label: 'Pedido', render: (row) => <span className="block max-w-xs truncate text-zinc-400" title={row.prompt}>{row.prompt}</span> },
    { key: 'credits', label: 'Créditos', align: 'right', render: (row) => formatNumber(row.credits) },
    { key: 'time', label: 'Tempo', align: 'right', render: (row) => (row.duration_seconds === null ? '–' : `${formatNumber(row.duration_seconds)} s`) },
  ]
  if (showCost) columns.push({ key: 'cost', label: 'Custo', align: 'right', render: (row) => formatUsd(row.cost_usd) })
  return columns
}

/** Todas as gerações, para suporte e investigação de falha. */
export function AdminGenerationsPage() {
  const [status, setStatus] = useState<string>(ALL)
  const [model, setModel] = useState<string>(ALL)
  const [email, setEmail] = useState('')
  const [page, setPage] = useState(0)
  const models = useQuery(fetchAdminModels, 'Não deu para carregar as ferramentas.')
  const load = useCallback(
    () => fetchGenerations({ status: status === ALL ? null : status, model: model === ALL ? null : model, email }, page),
    [status, model, email, page],
  )
  const list = useQuery(load, 'Não deu para carregar as gerações.')
  const showCost = list.data?.rows.some((row) => row.cost_usd !== null) ?? false
  const statusOptions = useMemo(() => [{ value: ALL, label: 'Todos' }, ...Object.entries(GENERATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))], [])
  const modelOptions = useMemo(() => [{ value: ALL, label: 'Todas' }, ...(models.data ?? []).map((item) => ({ value: item.slug, label: item.name }))], [models.data])
  const reset = () => setPage(0)

  return (
    <Page title="Gerações" description="Tudo o que foi pedido às IAs, da mais nova para a mais antiga. Falha mostra o motivo que o fornecedor devolveu.">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Status" value={status} options={statusOptions} onChange={(value) => { setStatus(value); reset() }} />
        <SelectField label="Ferramenta" value={model} options={modelOptions} onChange={(value) => { setModel(value); reset() }} />
      </div>
      <EmailSearch onSearch={(value) => { setEmail(value); reset() }} />
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data && list.loading && <Loading />}
      {list.data && (
        <div className={clsx('space-y-4 transition-opacity', list.loading && 'opacity-60')}>
          <DataTable caption="Gerações" rows={list.data.rows} columns={generationColumns(showCost)} rowKey={(row) => row.id} empty="Nenhuma geração com esse filtro." rowTone={(row) => (row.status === 'failed' ? 'bad' : undefined)} />
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </div>
      )}
    </Page>
  )
}

const SUBSCRIPTION_TONE = { active: 'good', past_due: 'bad', pending: 'warn', canceled: 'muted', expired: 'muted' } as const

function subscriptionColumns(showMoney: boolean): Column<AdminSubscription>[] {
  const columns: Column<AdminSubscription>[] = [
    { key: 'email', label: 'Conta', render: (row) => row.email ?? row.user_id.slice(0, 8) },
    { key: 'plan', label: 'Plano', render: (row) => `${row.plan_name} (v${row.plan_version})` },
    { key: 'status', label: 'Status', render: (row) => <StatusPill tone={SUBSCRIPTION_TONE[row.status]}>{STATUS_LABELS[row.status]}</StatusPill> },
    { key: 'credits', label: 'Créditos/mês', align: 'right', render: (row) => formatNumber(row.monthly_credits) },
    { key: 'since', label: 'Desde', render: (row) => when(row.created_at, date) },
    { key: 'renews', label: 'Vence', render: (row) => when(row.current_period_end, date) },
    { key: 'last', label: 'Último pagamento', render: (row) => when(row.last_paid_at, date) },
    { key: 'payments', label: 'Pagamentos', align: 'right', render: (row) => formatNumber(row.payments) },
  ]
  if (showMoney) {
    columns.splice(2, 0, { key: 'price', label: 'Preço', align: 'right', render: (row) => (row.price_cents === null ? '–' : formatBRL(row.price_cents)) })
    columns.push({ key: 'paid', label: 'Total pago', align: 'right', render: (row) => (row.paid_cents === null ? '–' : formatBRL(row.paid_cents)) })
  }
  return columns
}

/** Assinantes: status, vencimento e pagamentos, com contagem por status no topo. */
export function AdminSubscriptionsPage() {
  const [status, setStatus] = useState<string>(ALL)
  const [email, setEmail] = useState('')
  const [page, setPage] = useState(0)
  const load = useCallback(() => fetchSubscriptions(status === ALL ? null : status, email, page), [status, email, page])
  const list = useQuery(load, 'Não deu para carregar as assinaturas.')
  const showMoney = list.data?.rows.some((row) => row.price_cents !== null) ?? false
  const statusOptions = useMemo(() => [{ value: ALL, label: 'Todos' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))], [])
  const counts = list.data?.counts ?? {}

  return (
    <Page title="Assinaturas" description="Quem assina, em que plano, quando vence e o que já pagou. Os números vêm do Asaas pelo webhook.">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <li key={key} className="rounded-2xl bg-surface p-3 ring-1 ring-white/[0.06]">
            <p className="text-[12px] font-semibold text-zinc-400">{label}</p>
            <p className="mt-1 text-xl font-semibold text-zinc-50">{formatNumber(counts[key] ?? 0)}</p>
          </li>
        ))}
      </ul>
      <EmailSearch onSearch={(value) => { setEmail(value); setPage(0) }}>
        <SelectField label="Status" value={status} options={statusOptions} onChange={(value) => { setStatus(value); setPage(0) }} />
      </EmailSearch>
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {!list.data && list.loading && <Loading />}
      {list.data && (
        <div className={clsx('space-y-4 transition-opacity', list.loading && 'opacity-60')}>
          <DataTable caption="Assinaturas" rows={list.data.rows} columns={subscriptionColumns(showMoney)} rowKey={(row) => row.id} empty="Nenhuma assinatura com esse filtro." rowTone={(row) => (row.status === 'past_due' ? 'bad' : undefined)} />
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </div>
      )}
    </Page>
  )
}
