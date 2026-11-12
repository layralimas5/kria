import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { brtDay } from '@/domain/adminDashboard'
import { EXPENSE_CATEGORIES, EXPENSE_LABELS, type Expense, type ExpenseCategory } from '@/domain/business'
import { formatBRL, formatDate } from '@/domain/format'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useToast } from '@/hooks/useToast'
import { addExpense, voidExpense } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'

function AddExpenseForm({ onSaved }: { readonly onSaved: () => void }) {
  const notify = useToast()
  const [day, setDay] = useState(() => brtDay(new Date()))
  const [category, setCategory] = useState<ExpenseCategory>('infra')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cents = Math.round(Number.parseFloat(amount.replace(/\./g, '').replace(',', '.')) * 100)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!Number.isFinite(cents) || cents <= 0) return setError('Informe o valor em reais, por exemplo 129,90.')
    if (description.trim().length < 3) return setError('Descreva a despesa.')
    setBusy(true)
    setError(null)
    try {
      await addExpense({ incurredOn: day, category, description: description.trim(), amountCents: cents })
      notify('Despesa lançada.')
      setDescription('')
      setAmount('')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_12rem_1fr_9rem]">
        <TextField label="Data" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        <SelectField label="Categoria" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((value) => ({ value, label: EXPENSE_LABELS[value] }))} />
        <TextField label="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} placeholder="Supabase Pro de novembro" />
        <TextField label="Valor (R$)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="129,90" />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" loading={busy}>
        Lançar despesa
      </Button>
    </form>
  )
}

function VoidButton({ expense, onSaved }: { readonly expense: Expense; readonly onSaved: () => void }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    try {
      await voidExpense(expense.id, reason)
      notify('Despesa anulada. O registro continua no histórico.')
      setOpen(false)
      onSaved()
    } catch (voidError) {
      setError(errorMessage(voidError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Anular
      </button>
      <ConfirmDialog open={open} title="Anular despesa" confirmLabel="Anular" busy={busy} onConfirm={() => void confirm()} onCancel={() => setOpen(false)}>
        <p>
          {expense.description}, {formatBRL(expense.amount_cents)}. Sai do lucro estimado, mas o lançamento continua registrado.
        </p>
        <TextField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
        {error && <Notice tone="error">{error}</Notice>}
      </ConfirmDialog>
    </>
  )
}

/** Despesas reais da operação no período. Só elas entram no lucro estimado; nada é premissa. */
export function ExpensesPanel({ expenses, totalCents, onChanged }: { readonly expenses: readonly Expense[]; readonly totalCents: number; readonly onChanged: () => void }) {
  const { can } = useAdminAccess()
  const manage = can('expenses.manage')
  return (
    <section aria-labelledby="expenses-title" className="space-y-4 card-premium rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="expenses-title" className="text-sm font-bold text-zinc-200">
          Despesas registradas no período
        </h2>
        <span className="text-sm tabular-nums text-zinc-300">{formatBRL(totalCents)}</span>
      </div>
      {manage && <AddExpenseForm onSaved={onChanged} />}
      {expenses.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">Nenhuma despesa lançada no período. O lucro estimado considera só o custo de IA e as taxas.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05] rounded-xl bg-surface-2 text-sm">
          {expenses.map((expense) => (
            <li key={expense.id} className={clsx('flex items-center justify-between gap-3 px-3 py-2', expense.voided_at && 'opacity-50')}>
              <span className="min-w-0">
                <span className={clsx('block truncate text-zinc-200', expense.voided_at && 'line-through')}>{expense.description}</span>
                <span className="text-xs text-zinc-500">
                  {formatDate(`${expense.incurred_on}T12:00:00Z`)} · {EXPENSE_LABELS[expense.category]}
                  {expense.voided_at && ` · anulada: ${expense.void_reason ?? ''}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-zinc-300">{formatBRL(expense.amount_cents)}</span>
                {manage && !expense.voided_at && <VoidButton expense={expense} onSaved={onChanged} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
