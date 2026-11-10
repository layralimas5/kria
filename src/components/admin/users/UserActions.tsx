import { useState, type FormEvent } from 'react'
import { formatDate } from '@/domain/format'
import { useToast } from '@/hooks/useToast'
import { adjustCredits, grantPlan, revokePlanGrant, setSuspended } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'

export interface ActionTarget {
  readonly id: string
  readonly email: string | null
  readonly suspended_at: string | null
}

export const MIN_REASON = 5

/** Estado de uma ação sensível: revisar, confirmar, executar, avisar. */
export function useSensitiveAction(run: () => Promise<string>, onDone: () => void) {
  const notify = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      notify(await run())
      onDone()
    } catch (actionError) {
      setError(errorMessage(actionError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return { confirming, busy, error, setError, review: () => setConfirming(true), cancel: () => setConfirming(false), confirm }
}

export function AdjustCreditsForm({ user, onDone }: { readonly user: ActionTarget; readonly onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const value = Number.parseInt(amount, 10)
  const action = useSensitiveAction(async () => {
    const balance = await adjustCredits(user.id, value, reason)
    setAmount('')
    setReason('')
    return `Ajuste feito. Saldo agora: ${balance}.`
  }, onDone)

  function review(event: FormEvent) {
    event.preventDefault()
    if (!Number.isInteger(value) || value === 0) return action.setError('Informe um número inteiro diferente de zero. Use negativo para remover.')
    action.setError(null)
    action.review()
  }

  return (
    <form onSubmit={review} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <TextField label="Créditos (+/-)" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50 ou -20" />
        <TextField label="Justificativa (vai para a auditoria)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      </div>
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={!amount || reason.trim().length < MIN_REASON}>
        Revisar ajuste
      </Button>
      <ConfirmDialog
        open={action.confirming}
        title={value > 0 ? 'Adicionar créditos' : 'Remover créditos'}
        confirmLabel={value > 0 ? `Adicionar ${value}` : `Remover ${Math.abs(value)}`}
        busy={action.busy}
        onConfirm={() => void action.confirm()}
        onCancel={action.cancel}
      >
        <p>
          {value > 0 ? 'Entram' : 'Saem'} <strong className="text-zinc-100">{Math.abs(value)} créditos</strong> do saldo avulso de {user.email}. O movimento vai para o
          extrato e não se desfaz: para corrigir, faça um ajuste contrário.
        </p>
        <p className="text-zinc-400">Justificativa: {reason.trim()}</p>
      </ConfirmDialog>
    </form>
  )
}

export function SuspendForm({ user, onDone }: { readonly user: ActionTarget; readonly onDone: () => void }) {
  const suspended = user.suspended_at !== null
  const [reason, setReason] = useState('')
  const action = useSensitiveAction(async () => {
    await setSuspended(user.id, !suspended, reason)
    setReason('')
    return suspended ? 'Conta reativada.' : 'Conta bloqueada.'
  }, onDone)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        action.review()
      }}
      className="space-y-3"
    >
      <TextField label={suspended ? 'Motivo da reativação' : 'Motivo do bloqueio'} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={reason.trim().length < MIN_REASON}>
        {suspended ? 'Reativar conta' : 'Bloquear conta'}
      </Button>
      <ConfirmDialog
        open={action.confirming}
        title={suspended ? 'Reativar conta' : 'Bloquear conta'}
        confirmLabel={suspended ? 'Reativar' : 'Bloquear'}
        busy={action.busy}
        onConfirm={() => void action.confirm()}
        onCancel={action.cancel}
      >
        <p>
          {suspended
            ? `${user.email} volta a gerar normalmente.`
            : `${user.email} não gera, não compra e não assina enquanto estiver bloqueada. Saldo e criações ficam como estão.`}
        </p>
        <p className="text-zinc-400">Motivo: {reason.trim()}</p>
      </ConfirmDialog>
    </form>
  )
}

interface PlanGrantProps {
  readonly user: ActionTarget
  readonly plans: readonly { readonly slug: string; readonly name: string }[]
  readonly grant: { readonly plan_slug: string; readonly ends_at: string } | null
  readonly onDone: () => void
}

/**
 * Plano sem cobrança: libera ferramentas e limites do plano por um prazo. Não mexe na assinatura
 * (que só muda pelo pagamento), não entra no MRR e não dá créditos de plano.
 */
export function PlanGrantForm({ user, plans, grant, onDone }: PlanGrantProps) {
  const [plan, setPlan] = useState(plans[0]?.slug ?? '')
  const [days, setDays] = useState('30')
  const [reason, setReason] = useState('')
  const [revoking, setRevoking] = useState(false)
  const dayCount = Number.parseInt(days, 10)
  const planName = plans.find((item) => item.slug === plan)?.name ?? plan

  const action = useSensitiveAction(async () => {
    if (revoking) {
      await revokePlanGrant(user.id, reason)
      setReason('')
      return 'Cortesia encerrada. A conta volta ao plano que paga (ou ao Grátis).'
    }
    await grantPlan(user.id, plan, dayCount, reason)
    setReason('')
    return `Cortesia de ${planName} por ${dayCount} dias liberada.`
  }, onDone)

  function submit(event: FormEvent, revoke: boolean) {
    event.preventDefault()
    if (!revoke && (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 365)) return action.setError('Escolha de 1 a 365 dias.')
    action.setError(null)
    setRevoking(revoke)
    action.review()
  }

  return (
    <form onSubmit={(event) => submit(event, false)} className="space-y-3">
      {grant && (
        <Notice>
          Cortesia em vigor: {plans.find((item) => item.slug === grant.plan_slug)?.name ?? grant.plan_slug} até {formatDate(grant.ends_at)}.
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <SelectField label="Plano de cortesia" value={plan} onChange={setPlan} options={plans.map((item) => ({ value: item.slug, label: item.name }))} />
        <TextField label="Dias" inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} />
      </div>
      <TextField label="Justificativa (vai para a auditoria)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={!plan || reason.trim().length < MIN_REASON}>
          {grant ? 'Trocar cortesia' : 'Liberar cortesia'}
        </Button>
        {grant && (
          <Button type="button" variant="ghost" disabled={reason.trim().length < MIN_REASON} onClick={(event) => submit(event, true)}>
            Encerrar cortesia
          </Button>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Troca de plano pago acontece só pelo checkout da pessoa (Asaas): o painel nunca gera cobrança nem muda assinatura.
      </p>
      <ConfirmDialog
        open={action.confirming}
        title={revoking ? 'Encerrar cortesia' : `Cortesia de ${planName}`}
        confirmLabel={revoking ? 'Encerrar' : 'Liberar'}
        busy={action.busy}
        onConfirm={() => void action.confirm()}
        onCancel={action.cancel}
      >
        <p>
          {revoking
            ? `${user.email} perde o acesso de cortesia agora.`
            : `${user.email} usa o ${planName} por ${dayCount} dias, sem cobrança e sem créditos de plano. Assinatura paga, se houver, continua valendo antes.`}
        </p>
        <p className="text-zinc-400">Justificativa: {reason.trim()}</p>
      </ConfirmDialog>
    </form>
  )
}
