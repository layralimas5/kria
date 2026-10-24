import { useState } from 'react'
import { formatBRL } from '@/domain/format'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { fetchAdminPlans, updatePlan, type AdminPlan } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

function toCents(value: string): number {
  return Math.round(Number.parseFloat(value.replace(',', '.')) * 100)
}

function PlanRow({ plan, canEdit, onSaved }: { readonly plan: AdminPlan; readonly canEdit: boolean; readonly onSaved: () => void }) {
  const notify = useToast()
  const [price, setPrice] = useState((plan.price_cents / 100).toFixed(2).replace('.', ','))
  const [credits, setCredits] = useState(String(plan.monthly_credits))
  const [concurrent, setConcurrent] = useState(String(plan.max_concurrent))
  const [active, setActive] = useState(plan.active)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const update = {
    priceCents: plan.slug === 'gratis' ? 0 : toCents(price),
    monthlyCredits: Number.parseInt(credits, 10),
    maxConcurrent: Number.parseInt(concurrent, 10),
    active,
  }
  const newVersion = update.priceCents !== plan.price_cents || update.monthlyCredits !== plan.monthly_credits

  function review() {
    if (!Number.isFinite(update.priceCents) || !Number.isInteger(update.monthlyCredits) || !Number.isInteger(update.maxConcurrent)) {
      return setError('Confira os números.')
    }
    setError(null)
    setConfirming(true)
  }

  async function save() {
    setBusy(true)
    try {
      await updatePlan(plan.slug, update)
      notify(`${plan.name} salvo. Quem já assina segue no valor contratado até trocar de plano.`)
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <article className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-headline text-xl text-zinc-100">{plan.name}</h3>
        <span className="text-xs text-zinc-500">
          versão {plan.version} · {plan.public ? formatBRL(plan.price_cents) : 'interno'}
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Preço (R$/mês)" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} disabled={!canEdit || plan.slug === 'gratis'} />
        <TextField label="Créditos por mês" inputMode="numeric" value={credits} onChange={(event) => setCredits(event.target.value)} disabled={!canEdit} />
        <TextField label="Gerações simultâneas" inputMode="numeric" value={concurrent} onChange={(event) => setConcurrent(event.target.value)} disabled={!canEdit} />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={!canEdit} className="size-4 accent-[var(--color-accent)]" />
        Plano ativo (aparece para assinar)
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      {canEdit && (
        <Button variant="secondary" onClick={review}>
          Revisar {plan.name}
        </Button>
      )}
      <ConfirmDialog open={confirming} title={`Salvar ${plan.name}`} confirmLabel="Salvar plano" busy={busy} onConfirm={() => void save()} onCancel={() => setConfirming(false)}>
        <p>
          {formatBRL(update.priceCents)} por mês, {update.monthlyCredits.toLocaleString('pt-BR')} créditos, {update.maxConcurrent} gerações ao mesmo tempo
          {update.active ? '' : ', fora da venda'}.
        </p>
        <p className="text-zinc-400">
          {newVersion
            ? `Vira a versão ${plan.version + 1}. Quem já assina mantém o valor e os créditos contratados; a vitrine da landing (catalog.ts) precisa mudar junto.`
            : 'Preço e créditos não mudam, então a versão continua a mesma.'}
        </p>
      </ConfirmDialog>
    </article>
  )
}

export function PlansTab() {
  const { can } = useAdminAccess()
  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  return (
    <div className="space-y-4">
      {plans.error && <Notice tone="error">{plans.error}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.data?.map((plan) => <PlanRow key={`${plan.slug}:${plan.version}:${plan.active}`} plan={plan} canEdit={can('plans.manage')} onSaved={() => void plans.reload()} />)}
      </div>
    </div>
  )
}
