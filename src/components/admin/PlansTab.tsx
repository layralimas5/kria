import { useState } from 'react'
import { formatBRL } from '@/domain/format'
import { useQuery } from '@/hooks/useQuery'
import { fetchAdminPlans, updatePlan, type AdminPlan } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

function toCents(value: string): number {
  return Math.round(Number.parseFloat(value.replace(',', '.')) * 100)
}

function PlanRow({ plan, onSaved }: { readonly plan: AdminPlan; readonly onSaved: () => void }) {
  const [price, setPrice] = useState((plan.price_cents / 100).toFixed(2).replace('.', ','))
  const [credits, setCredits] = useState(String(plan.monthly_credits))
  const [concurrent, setConcurrent] = useState(String(plan.max_concurrent))
  const [active, setActive] = useState(plan.active)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  async function save() {
    const update = {
      priceCents: plan.slug === 'gratis' ? 0 : toCents(price),
      monthlyCredits: Number.parseInt(credits, 10),
      maxConcurrent: Number.parseInt(concurrent, 10),
      active,
    }
    if (!Number.isFinite(update.priceCents) || !Number.isInteger(update.monthlyCredits) || !Number.isInteger(update.maxConcurrent)) {
      return setMessage({ tone: 'error', text: 'Confira os números.' })
    }
    setBusy(true)
    setMessage(null)
    try {
      await updatePlan(plan.slug, update)
      setMessage({ tone: 'success', text: 'Plano salvo. Quem já assina segue no valor contratado até trocar de plano.' })
      onSaved()
    } catch (saveError) {
      setMessage({ tone: 'error', text: errorMessage(saveError) })
    } finally {
      setBusy(false)
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
        <TextField label="Preço (R$/mês)" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} disabled={plan.slug === 'gratis'} />
        <TextField label="Créditos por mês" inputMode="numeric" value={credits} onChange={(event) => setCredits(event.target.value)} />
        <TextField label="Gerações simultâneas" inputMode="numeric" value={concurrent} onChange={(event) => setConcurrent(event.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        Plano ativo (aparece para assinar)
      </label>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button variant="secondary" loading={busy} onClick={() => void save()}>
        Salvar {plan.name}
      </Button>
    </article>
  )
}

export function PlansTab() {
  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Mudar preço ou créditos cria uma versão nova do plano. Assinaturas existentes guardam o valor contratado.
      </p>
      {plans.error && <Notice tone="error">{plans.error}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.data?.map((plan) => <PlanRow key={`${plan.slug}:${plan.version}`} plan={plan} onSaved={() => void plans.reload()} />)}
      </div>
    </div>
  )
}
