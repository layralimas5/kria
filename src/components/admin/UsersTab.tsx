import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { formatBRL, formatDateTime } from '@/domain/format'
import { STATUS_LABELS } from '@/domain/plans'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { adjustCredits, fetchUserDetail, searchUsers, setSuspended, type AdminUser } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function AdjustForm({ user, onDone }: { readonly user: AdminUser; readonly onDone: () => void }) {
  const notify = useToast()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = Number.parseInt(amount, 10)

  function review(event: FormEvent) {
    event.preventDefault()
    if (!Number.isInteger(value) || value === 0) return setError('Informe um número inteiro diferente de zero.')
    setError(null)
    setConfirming(true)
  }

  async function apply() {
    setBusy(true)
    try {
      const balance = await adjustCredits(user.id, value, reason)
      notify(`Ajuste feito. Saldo agora: ${balance}.`)
      setAmount('')
      setReason('')
      onDone()
    } catch (adjustError) {
      setError(errorMessage(adjustError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form onSubmit={review} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <TextField label="Créditos (+/-)" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50" />
        <TextField label="Motivo (fica na auditoria)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" disabled={!amount || reason.trim().length < 5}>
        Revisar ajuste
      </Button>
      <ConfirmDialog
        open={confirming}
        title={value > 0 ? 'Conceder créditos' : 'Remover créditos'}
        confirmLabel={value > 0 ? `Conceder ${value}` : `Remover ${Math.abs(value)}`}
        busy={busy}
        onConfirm={() => void apply()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {value > 0 ? 'Entram' : 'Saem'} <strong className="text-zinc-100">{Math.abs(value)} créditos</strong> do saldo comprado de {user.email}. O
          movimento vai para o extrato da pessoa e não se desfaz: para corrigir, faça um ajuste contrário.
        </p>
        <p className="text-zinc-400">Motivo: {reason.trim()}</p>
      </ConfirmDialog>
    </form>
  )
}

function SuspendForm({ user, onDone }: { readonly user: AdminUser; readonly onDone: () => void }) {
  const notify = useToast()
  const suspended = user.suspended_at !== null
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    setBusy(true)
    setError(null)
    try {
      await setSuspended(user.id, !suspended, reason)
      notify(suspended ? 'Conta reativada.' : 'Conta suspensa.')
      setReason('')
      onDone()
    } catch (suspendError) {
      setError(errorMessage(suspendError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setConfirming(true)
      }}
      className="space-y-3"
    >
      <TextField label={suspended ? 'Motivo da reativação' : 'Motivo da suspensão'} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" disabled={reason.trim().length < 5}>
        {suspended ? 'Reativar conta' : 'Suspender conta'}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={suspended ? 'Reativar conta' : 'Suspender conta'}
        confirmLabel={suspended ? 'Reativar' : 'Suspender'}
        busy={busy}
        onConfirm={() => void apply()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {suspended
            ? `${user.email} volta a gerar normalmente.`
            : `${user.email} não consegue mais gerar nada enquanto estiver suspensa. O saldo e as criações ficam como estão.`}
        </p>
        <p className="text-zinc-400">Motivo: {reason.trim()}</p>
      </ConfirmDialog>
    </form>
  )
}

function UserDetailPanel({ user, onChanged }: { readonly user: AdminUser; readonly onChanged: () => void }) {
  const { can } = useAdminAccess()
  const load = useCallback(() => fetchUserDetail(user.id), [user.id])
  const detail = useQuery(load, 'Não deu para carregar o histórico.')
  const refreshAll = () => {
    void detail.reload()
    onChanged()
  }

  return (
    <div className="space-y-6 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <div>
        <p className="text-lg font-bold text-zinc-50">{user.display_name || user.username}</p>
        <p className="text-sm text-zinc-400">
          {user.email} · @{user.username}
        </p>
        <p className="mt-2 text-sm text-zinc-300">
          Saldo {user.balance ?? 0} ({user.subscription_balance ?? 0} plano · {user.purchased_balance ?? 0} comprado) · {user.plan_slug ?? 'grátis'}
          {user.subscription_status && ` (${STATUS_LABELS[user.subscription_status]})`}
        </p>
        {user.suspended_at && <p className="mt-1 text-sm font-semibold text-red-300">Suspensa desde {formatDateTime(user.suspended_at)}</p>}
      </div>

      {(can('credits.adjust') || can('users.manage')) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {can('credits.adjust') && (
            <section aria-label="Ajustar créditos">
              <h3 className="mb-2 text-sm font-bold text-zinc-200">Ajustar créditos</h3>
              <AdjustForm user={user} onDone={refreshAll} />
            </section>
          )}
          {can('users.manage') && (
            <section aria-label="Suspensão">
              <h3 className="mb-2 text-sm font-bold text-zinc-200">Suspensão</h3>
              <SuspendForm user={user} onDone={refreshAll} />
            </section>
          )}
        </div>
      )}

      {detail.error && <Notice tone="error">{detail.error}</Notice>}
      {detail.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Gerações">
            <h3 className="mb-2 text-sm font-bold text-zinc-200">Gerações recentes</h3>
            <ul className="max-h-72 divide-y divide-white/[0.05] overflow-y-auto rounded-2xl bg-surface-2 text-sm">
              {detail.data.generations.map((generation) => (
                <li key={generation.id} className="flex justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-zinc-300">
                    {generation.model_slug} · {generation.status}
                    {generation.error && <span className="text-zinc-500"> · {generation.error}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500">{generation.credits} cr</span>
                </li>
              ))}
              {detail.data.generations.length === 0 && <li className="px-3 py-4 text-center text-zinc-500">Nenhuma geração.</li>}
            </ul>
          </section>
          <section aria-label="Financeiro">
            <h3 className="mb-2 text-sm font-bold text-zinc-200">{detail.data.payments === null ? 'Extrato de créditos' : 'Pagamentos e extrato'}</h3>
            <ul className="max-h-72 divide-y divide-white/[0.05] overflow-y-auto rounded-2xl bg-surface-2 text-sm">
              {detail.data.payments === null && <li className="px-3 py-2 text-xs text-zinc-500">Pagamentos ficam com o financeiro.</li>}
              {detail.data.payments?.map((payment, index) => (
                <li key={`p-${index}`} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-zinc-300">
                    {payment.type === 'subscription' ? 'Mensalidade' : 'Pacote'} · {payment.status}
                  </span>
                  <span className="tabular-nums text-zinc-400">{formatBRL(payment.amount_cents)}</span>
                </li>
              ))}
              {detail.data.ledger.map((entry) => (
                <li key={`l-${entry.id}`} className="flex justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-zinc-400">
                    {entry.reason} {entry.note && `· ${entry.note}`}
                  </span>
                  <span className={clsx('shrink-0 tabular-nums', entry.delta > 0 ? 'text-accent' : 'text-zinc-500')}>
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}

export function UsersTab() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const load = useCallback(() => searchUsers(submitted), [submitted])
  const users = useQuery(load, 'Não deu para buscar usuários.')
  const selected = users.data?.find((user) => user.id === selectedId) ?? null

  useEffect(() => setSelectedId(null), [submitted])

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setSubmitted(query.trim())
        }}
        className="flex gap-2"
        role="search"
      >
        <label htmlFor="admin-user-search" className="sr-only">
          Buscar por e-mail, @ ou nome
        </label>
        <input
          id="admin-user-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="E-mail, @ ou nome"
          className="min-h-10 w-full max-w-md rounded-xl border border-white/[0.08] bg-surface-2 px-3.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <Button type="submit" variant="secondary" aria-label="Buscar">
          <Search className="size-4" aria-hidden="true" />
        </Button>
      </form>

      {users.error && <Notice tone="error">{users.error}</Notice>}

      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-white/[0.06]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">Conta</th>
              <th scope="col" className="px-4 py-3 font-bold">Plano</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">Saldo</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">Gerações</th>
              <th scope="col" className="px-4 py-3 font-bold">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {users.data?.map((user) => (
              <tr key={user.id} className={clsx(user.id === selectedId && 'bg-white/[0.04]')}>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedId(user.id === selectedId ? null : user.id)}
                    aria-expanded={user.id === selectedId}
                    className={clsx('rounded text-left', FOCUS)}
                  >
                    <span className="block font-semibold text-zinc-100">{user.email}</span>
                    <span className="text-xs text-zinc-500">
                      @{user.username}
                      {user.suspended_at && <span className="font-semibold text-red-300"> · suspensa</span>}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-2.5 text-zinc-300">
                  {user.plan_slug ?? 'grátis'}
                  {user.subscription_status && <span className="text-xs text-zinc-500"> · {STATUS_LABELS[user.subscription_status]}</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-200">{user.balance ?? 0}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{user.generations}</td>
                <td className="px-4 py-2.5 text-zinc-500">{formatDateTime(user.created_at)}</td>
              </tr>
            ))}
            {users.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Ninguém encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <UserDetailPanel key={selected.id} user={selected} onChanged={() => void users.reload()} />}
    </div>
  )
}
