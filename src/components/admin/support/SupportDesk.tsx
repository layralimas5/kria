import clsx from 'clsx'
import { ArrowLeft, CircleDot, Clock, Headset, Inbox, Mail, RefreshCw, Search, CheckCircle2 } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDateTime } from '@/domain/format'
import {
  ADMIN_STATUS_LABEL,
  CATEGORY_LABEL,
  DEFAULT_QUEUE_FILTERS,
  filterQueue,
  PRIORITY_LABEL,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  ticketCode,
  type AdminQueue,
  type AdminTicket,
  type AdminTicketRow,
  type QueueFilters,
  type TicketPriority,
  type TicketStatus,
} from '@/domain/supportTickets'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { announceSupportChange } from '@/hooks/useSupportAttention'
import { useToast } from '@/hooks/useToast'
import { errorMessage } from '@/lib/api'
import { adminReply, adminUpdateTicket, fetchAdminQueue, fetchAdminTicket } from '@/lib/supportTicketsApi'
import { PriorityPill, ReplyBox, StatusPill, TicketThread, UnreadDot } from '../../support/TicketBits'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'
import { Spinner } from '../../ui/Spinner'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const TICKET_PARAM = 'chamado'

const STATUS_FILTERS: readonly { readonly value: QueueFilters['status']; readonly label: string }[] = [
  { value: 'active', label: 'Ativos (sem resolvidos)' },
  { value: 'all', label: 'Todos' },
  ...TICKET_STATUSES.map((value) => ({ value, label: ADMIN_STATUS_LABEL[value] })),
]
const PRIORITY_FILTERS: readonly { readonly value: QueueFilters['priority']; readonly label: string }[] = [
  { value: 'all', label: 'Todas' },
  ...TICKET_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABEL[value] })),
]
const STATUS_OPTIONS = TICKET_STATUSES.map((value) => ({ value, label: ADMIN_STATUS_LABEL[value] }))
const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABEL[value] }))

/** Depois de responder: o comum é esperar a pessoa; dá para já resolver ou manter em atendimento. */
type AfterReply = 'waiting_user' | 'in_progress' | 'resolved'
const AFTER_REPLY: readonly { readonly value: AfterReply; readonly label: string }[] = [
  { value: 'waiting_user', label: 'Aguardar o usuário' },
  { value: 'in_progress', label: 'Manter em atendimento' },
  { value: 'resolved', label: 'Marcar como resolvido' },
]

const KPIS: readonly { readonly status: TicketStatus; readonly icon: ReactNode; readonly tone: string }[] = [
  { status: 'open', icon: <CircleDot className="size-4" aria-hidden="true" />, tone: 'text-accent-soft' },
  { status: 'in_progress', icon: <Headset className="size-4" aria-hidden="true" />, tone: 'text-sky-300' },
  { status: 'waiting_user', icon: <Clock className="size-4" aria-hidden="true" />, tone: 'text-amber-300' },
  { status: 'resolved', icon: <CheckCircle2 className="size-4" aria-hidden="true" />, tone: 'text-emerald-300' },
]

function Loading() {
  return (
    <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

function Kpis({ counts, active, onPick }: { readonly counts: AdminQueue['counts']; readonly active: QueueFilters['status']; readonly onPick: (status: TicketStatus) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Chamados por situação">
      {KPIS.map((kpi) => (
        <li key={kpi.status}>
          <button
            type="button"
            onClick={() => onPick(kpi.status)}
            aria-pressed={active === kpi.status}
            className={clsx('card-premium card-hover w-full rounded-2xl p-4 text-left', FOCUS, active === kpi.status && 'ring-1 ring-accent/40')}
          >
            <span className={clsx('flex items-center gap-2 text-xs font-semibold', kpi.tone)}>
              {kpi.icon}
              {ADMIN_STATUS_LABEL[kpi.status]}
            </span>
            <span className="mt-2 block font-headline text-3xl tabular-nums text-zinc-50">{counts[kpi.status]}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Filters({ filters, onChange, onRefresh, refreshing }: { readonly filters: QueueFilters; readonly onChange: (next: QueueFilters) => void; readonly onRefresh: () => void; readonly refreshing: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_10rem_auto] lg:items-end">
      <div>
        <label htmlFor="ticket-search" className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
          Buscar
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            id="ticket-search"
            type="search"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Número, título, e-mail ou nome"
            className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-surface-2 pl-9 pr-3 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>
      <SelectField label="Situação" value={filters.status} onChange={(status) => onChange({ ...filters, status })} options={STATUS_FILTERS} />
      <SelectField label="Prioridade" value={filters.priority} onChange={(priority) => onChange({ ...filters, priority })} options={PRIORITY_FILTERS} />
      <Button variant="secondary" onClick={onRefresh} disabled={refreshing} className="min-h-11" aria-label="Atualizar a fila">
        <RefreshCw className={clsx('size-4', refreshing && 'motion-safe:animate-spin')} aria-hidden="true" />
        <span className="sm:hidden lg:inline">Atualizar</span>
      </Button>
    </div>
  )
}

function QueueRow({ row, selected, onOpen }: { readonly row: AdminTicketRow; readonly selected: boolean; readonly onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? 'true' : undefined}
        className={clsx(
          'relative flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors',
          FOCUS,
          selected ? 'bg-accent/[0.09]' : 'hover:bg-white/[0.03]',
        )}
      >
        {selected && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent-strong" />}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums text-zinc-500">{ticketCode(row)}</span>
          <StatusPill status={row.status} audience="admin" />
          <PriorityPill priority={row.priority} />
          {row.unread && <UnreadDot label="Mensagem nova" />}
        </div>
        <p className={clsx('truncate text-[14.5px]', row.unread ? 'font-semibold text-zinc-50' : 'text-zinc-200')}>{row.subject}</p>
        <p className="truncate text-xs text-zinc-500">
          {row.display_name ?? row.email ?? 'Conta excluída'}
          {row.plan_name && ` · ${row.plan_name}`} · {CATEGORY_LABEL[row.category]} · {formatDateTime(row.updated_at)}
        </p>
      </button>
    </li>
  )
}

interface DetailProps {
  readonly id: string
  readonly canManage: boolean
  readonly onBack: () => void
  readonly onChanged: () => void
}

function TicketDetail({ id, canManage, onBack, onChanged }: DetailProps) {
  const notify = useToast()
  const load = useCallback(() => fetchAdminTicket(id), [id])
  const query = useQuery(load, 'Não deu para abrir o chamado.')
  const [ticket, setTicket] = useState<AdminTicket | null>(null)
  const [internal, setInternal] = useState(false)
  const [after, setAfter] = useState<AfterReply>('waiting_user')
  const [saving, setSaving] = useState(false)
  const current = ticket ?? query.data

  const changed = (next: AdminTicket) => {
    setTicket(next)
    onChanged()
    announceSupportChange()
  }

  async function update(change: { readonly status?: TicketStatus; readonly priority?: TicketPriority }) {
    setSaving(true)
    try {
      changed(await adminUpdateTicket(id, change))
      notify('Chamado atualizado.')
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function reply(body: string): Promise<boolean> {
    try {
      changed(await adminReply(id, body, internal, internal ? null : after))
      notify(internal ? 'Nota interna salva.' : 'Resposta enviada.')
      return true
    } catch (error) {
      notify(errorMessage(error), 'error')
      return false
    }
  }

  return (
    <section className="card-premium min-w-0 space-y-5 rounded-2xl p-4 sm:p-6" aria-labelledby="admin-ticket-title">
      <button type="button" onClick={onBack} className={clsx('inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-zinc-400 hover:text-zinc-100 lg:hidden', FOCUS)}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar para a fila
      </button>
      {query.error && <Notice tone="error">{query.error}</Notice>}
      {!current && query.loading && <Loading />}
      {current && (
        <>
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold tabular-nums">{ticketCode(current)}</span>
              <StatusPill status={current.status} audience="admin" />
              <PriorityPill priority={current.priority} />
              <span>{CATEGORY_LABEL[current.category]}</span>
            </div>
            <h2 id="admin-ticket-title" className="font-headline text-2xl text-balance text-zinc-50">
              {current.subject}
            </h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">Quem abriu</dt>
                <dd className="flex items-center gap-1.5 truncate text-zinc-200">
                  <Mail className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  {current.email ? (
                    <a href={`mailto:${current.email}`} className="truncate underline-offset-4 hover:underline">
                      {current.display_name ? `${current.display_name} (${current.email})` : current.email}
                    </a>
                  ) : (
                    'Conta excluída'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Plano</dt>
                <dd className="text-zinc-200">
                  {current.current_plan ?? current.plan_name ?? 'Sem plano'}
                  {current.plan_name && current.current_plan && current.plan_name !== current.current_plan && (
                    <span className="text-zinc-500"> (abriu no {current.plan_name})</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Aberto em</dt>
                <dd className="text-zinc-200">{formatDateTime(current.created_at)}</dd>
              </div>
              {current.resolved_at && (
                <div>
                  <dt className="text-xs text-zinc-500">Resolvido em</dt>
                  <dd className="text-zinc-200">{formatDateTime(current.resolved_at)}</dd>
                </div>
              )}
            </dl>
          </header>

          {canManage && (
            <div className="grid gap-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.05] sm:grid-cols-2">
              <SelectField label="Situação" value={current.status} onChange={(status) => void update({ status })} options={STATUS_OPTIONS} disabled={saving} />
              <SelectField label="Prioridade" value={current.priority} onChange={(priority) => void update({ priority })} options={PRIORITY_OPTIONS} disabled={saving} />
            </div>
          )}

          <TicketThread messages={current.messages} audience="admin" />

          {canManage ? (
            <ReplyBox
              label={internal ? 'Nota interna (o usuário não vê)' : 'Resposta para o usuário'}
              placeholder={internal ? 'Anotação para a equipe.' : 'Escreva a resposta.'}
              submitLabel={internal ? 'Salvar nota' : 'Enviar resposta'}
              onSubmit={reply}
              extra={
                <>
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} className="size-4 accent-amber-400" />
                    Nota interna
                  </label>
                  {!internal && (
                    <label className="inline-flex items-center gap-2 text-sm text-zinc-400">
                      <span className="sr-only sm:not-sr-only">Depois:</span>
                      <select
                        value={after}
                        onChange={(event) => {
                          const chosen = AFTER_REPLY.find((option) => option.value === event.target.value)
                          if (chosen) setAfter(chosen.value)
                        }}
                        className="min-h-11 rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-sm text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                      >
                        {AFTER_REPLY.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              }
            />
          ) : (
            <Notice tone="info">Seu acesso só permite ler os chamados.</Notice>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Central de chamados (0042), no estilo GLPI: indicadores por situação, fila filtrável e o chamado aberto ao lado,
 * com resposta, nota interna, situação e prioridade. No celular, a fila e o chamado se alternam.
 */
export function SupportDesk() {
  const { can } = useAdminAccess()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<QueueFilters>(DEFAULT_QUEUE_FILTERS)
  const queue = useQuery(fetchAdminQueue, 'Não deu para carregar os chamados.')
  const openId = params.get(TICKET_PARAM)
  const rows = useMemo(() => filterQueue(queue.data?.tickets ?? [], filters), [queue.data, filters])

  const show = (id: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (id) next.set(TICKET_PARAM, id)
      else next.delete(TICKET_PARAM)
      return next
    })

  const refresh = () => {
    void queue.reload()
    announceSupportChange()
  }

  return (
    <div className="space-y-5">
      {queue.error && <Notice tone="error">{queue.error}</Notice>}
      {queue.data && <Kpis counts={queue.data.counts} active={filters.status} onPick={(status) => setFilters({ ...filters, status })} />}
      <Filters filters={filters} onChange={setFilters} onRefresh={refresh} refreshing={queue.loading} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
        <div className={clsx('card-premium overflow-hidden rounded-2xl lg:sticky lg:top-20', openId && 'hidden lg:block')}>
          {!queue.data && queue.loading && <Loading />}
          {queue.data && rows.length === 0 && (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <Inbox className="size-6 text-zinc-500" aria-hidden="true" />
              <p className="mt-3 text-sm text-zinc-400">
                {queue.data.tickets.length === 0 ? 'Nenhum chamado ainda. Eles chegam pela aba Suporte do app.' : 'Nenhum chamado com esses filtros.'}
              </p>
            </div>
          )}
          {rows.length > 0 && (
            <ul className="max-h-[70vh] divide-y divide-white/[0.05] overflow-y-auto" aria-label="Fila de chamados">
              {rows.map((row) => (
                <QueueRow key={row.id} row={row} selected={row.id === openId} onOpen={() => show(row.id)} />
              ))}
            </ul>
          )}
        </div>

        {openId ? (
          <TicketDetail key={openId} id={openId} canManage={can('support.manage')} onBack={() => show(null)} onChanged={() => void queue.reload()} />
        ) : (
          <div className="card-premium hidden flex-col items-center rounded-2xl px-6 py-20 text-center lg:flex">
            <Headset className="size-7 text-accent-soft" aria-hidden="true" />
            <p className="mt-3 font-semibold text-zinc-100">Escolha um chamado na fila</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-400">Os não lidos e os mais urgentes ficam no topo; entre a mesma prioridade, quem espera há mais tempo vem primeiro.</p>
          </div>
        )}
      </div>
    </div>
  )
}
