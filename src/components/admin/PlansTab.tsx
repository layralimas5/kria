import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatBRL } from '@/domain/format'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { fetchAdminPlans, fetchPlanEconomics, fetchSupportSettings, updatePlan, updatePlanLimits, type AdminPlan } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Section } from './dashboard/DashboardSections'
import { PlanTargets } from './finance/PlanTargets'
import { SupportContactsForm } from './SupportContactsForm'
import { formatPercent } from './finance/format'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

function toCents(value: string): number {
  return Math.round(Number.parseFloat(value.replace(',', '.')) * 100)
}

/** Vazio = sem limite. */
const parseLimit = (value: string): number | null => (value.trim() === '' ? null : Number.parseInt(value, 10))
const limitInput = (value: number | null) => (value === null ? '' : String(value))
const limitText = (value: number | null) => (value === null ? 'sem limite' : `${value.toLocaleString('pt-BR')} créditos`)
const validLimit = (value: number | null) => value === null || (Number.isInteger(value) && value > 0)

function PlanRow({ plan, canEdit, onSaved }: { readonly plan: AdminPlan; readonly canEdit: boolean; readonly onSaved: () => void }) {
  const notify = useToast()
  const [price, setPrice] = useState((plan.price_cents / 100).toFixed(2).replace('.', ','))
  const [credits, setCredits] = useState(String(plan.monthly_credits))
  const [concurrent, setConcurrent] = useState(String(plan.max_concurrent))
  const [active, setActive] = useState(plan.active)
  const [daily, setDaily] = useState(limitInput(plan.daily_credit_limit))
  const [monthly, setMonthly] = useState(limitInput(plan.monthly_credit_limit))
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
  const limits = { daily: parseLimit(daily), monthly: parseLimit(monthly) }
  const limitsChanged = limits.daily !== plan.daily_credit_limit || limits.monthly !== plan.monthly_credit_limit

  function review() {
    if (!Number.isFinite(update.priceCents) || !Number.isInteger(update.monthlyCredits) || !Number.isInteger(update.maxConcurrent)) {
      return setError('Confira os números.')
    }
    if (!validLimit(limits.daily) || !validLimit(limits.monthly)) return setError('Limite precisa ser um inteiro positivo ou ficar vazio.')
    if (limits.daily !== null && limits.monthly !== null && limits.daily > limits.monthly) return setError('O limite do dia não pode passar o do mês.')
    setError(null)
    setConfirming(true)
  }

  async function save() {
    setBusy(true)
    try {
      await updatePlan(plan.slug, update)
      if (limitsChanged) await updatePlanLimits(plan.slug, limits.daily, limits.monthly)
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
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Limite de consumo por dia" inputMode="numeric" value={daily} onChange={(event) => setDaily(event.target.value)} disabled={!canEdit} hint="Em créditos. Vazio = sem limite." />
        <TextField label="Limite de consumo por mês" inputMode="numeric" value={monthly} onChange={(event) => setMonthly(event.target.value)} disabled={!canEdit} hint="Conta crédito do plano e comprado." />
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
          {update.active ? '' : ', fora da venda'}. Consumo: {limitText(limits.daily)} por dia, {limitText(limits.monthly)} por mês.
        </p>
        {limitsChanged && <p className="text-zinc-400">O limite de consumo vale na hora para todas as contas do plano, sem versão nova.</p>}
        <p className="text-zinc-400">
          {newVersion
            ? `Vira a versão ${plan.version + 1}. Quem já assina mantém o valor e os créditos contratados; a vitrine da landing (catalog.ts) precisa mudar junto.`
            : 'Preço e créditos não mudam, então a versão continua a mesma.'}
        </p>
      </ConfirmDialog>
    </article>
  )
}

function DraftCard({ plan, margin, target }: { readonly plan: AdminPlan; readonly margin: number | null; readonly target: number | null }) {
  const below = margin !== null && target !== null && margin < target
  return (
    <article className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-dashed ring-white/[0.1]">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-headline text-xl text-zinc-100">{plan.name}</h3>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-zinc-400">rascunho</span>
      </header>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[12px] text-zinc-500">Preço</dt>
          <dd className="font-semibold text-zinc-100">{formatBRL(plan.price_cents)}/mês</dd>
        </div>
        <div>
          <dt className="text-[12px] text-zinc-500">Créditos</dt>
          <dd className="font-semibold text-zinc-100">{plan.monthly_credits.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-zinc-500">Margem no uso integral</dt>
          <dd className={below ? 'font-semibold text-red-300' : 'font-semibold text-accent-soft'}>{formatPercent(margin)}</dd>
        </div>
      </dl>
    </article>
  )
}

export function PlansTab() {
  const { can } = useAdminAccess()
  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  const economics = useQuery(fetchPlanEconomics, 'Não deu para carregar a margem dos planos.')
  const all = plans.data ?? []
  const support = useQuery(fetchSupportSettings, 'Não deu para carregar os contatos de suporte.')
  const selling = all.filter((plan) => plan.status === 'live')
  // Saíram da venda na virada; quem já assina continua com o contratado.
  const legacy = all.filter((plan) => plan.status === 'legacy')
  const drafts = all.filter((plan) => plan.status === 'draft' && plan.line === 'creator')
  const marginOf = (slug: string) => economics.data?.plans.find((plan) => plan.slug === slug)?.full_use_margin ?? null
  const target = economics.data?.finance.min_margin_rate ?? null

  return (
    <div className="space-y-10">
      {plans.error && <Notice tone="error">{plans.error}</Notice>}

      <Section title="No checkout agora" description="É o que quem assina hoje paga e recebe. Mudar preço ou créditos aqui cria uma versão nova do plano; quem já assina mantém o contratado.">
        <div className="grid gap-4 lg:grid-cols-2">
          {selling.map((plan) => (
            <PlanRow key={`${plan.slug}:${plan.version}:${plan.active}:${plan.daily_credit_limit}:${plan.monthly_credit_limit}`} plan={plan} canEdit={can('plans.manage')} onSaved={() => void plans.reload()} />
          ))}
        </div>
      </Section>

      {legacy.length > 0 && (
        <Section title="Planos antigos" description="Fora de venda desde a virada. Quem já assina continua com o preço contratado e os créditos convertidos para a régua nova.">
          <ul className="divide-y divide-white/[0.05] rounded-2xl bg-surface ring-1 ring-white/[0.06]">
            {legacy.map((plan) => (
              <li key={plan.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-zinc-100">{plan.name}</span>
                <span className="tabular-nums text-zinc-400">
                  {formatBRL(plan.price_cents)} · {plan.monthly_credits.toLocaleString('pt-BR')} créditos
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Canais de suporte" description="O que a aba Suporte do app mostra: e-mail no Starter, WhatsApp no Pro e no Max. Cada plano recebe só o contato do seu canal.">
        {support.error && <Notice tone="error">{support.error}</Notice>}
        {support.data && (
          <SupportContactsForm key={support.data.updated_at} settings={support.data} canEdit={can('plans.manage')} onSaved={() => void support.reload()} />
        )}
      </Section>

      {drafts.length > 0 && (
        <Section title="Proposta nova, em rascunho" description="Não aparece no checkout nem na landing. Só entra no ar pela virada de preços, com a sua aprovação.">
          <div className="grid gap-4 lg:grid-cols-3">
            {drafts.map((plan) => (
              <DraftCard key={plan.slug} plan={plan} margin={marginOf(plan.slug)} target={target} />
            ))}
          </div>
          <p className="text-sm text-zinc-400">
            Créditos e preço dos rascunhos mudam na{' '}
            <Link to="/admin/financeiro?aba=calculadora" className="font-semibold text-accent-soft underline-offset-4 hover:underline">
              calculadora de planos
            </Link>
            , e a virada fica em{' '}
            <Link to="/admin/financeiro?aba=creditos" className="font-semibold text-accent-soft underline-offset-4 hover:underline">
              Preços e créditos
            </Link>
            .
          </p>
        </Section>
      )}

      {economics.data && <PlanTargets economics={economics.data} />}
    </div>
  )
}
