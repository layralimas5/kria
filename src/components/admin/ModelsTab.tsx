import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { grossMargin, suggestedCredits, type PricingSettings } from '@/domain/pricing'
import { useQuery } from '@/hooks/useQuery'
import { fetchAdminModels, fetchAdminPlans, fetchOverview, updateModel, updatePricing, type AdminModel } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'

const parseDecimal = (value: string) => Number.parseFloat(value.replace(',', '.'))

function PricingForm({ settings, onSaved }: { readonly settings: PricingSettings; readonly onSaved: () => void }) {
  const [usdBrl, setUsdBrl] = useState(String(settings.usd_brl))
  const [fxBuffer, setFxBuffer] = useState(String(settings.fx_buffer * 100))
  const [markup, setMarkup] = useState(String(settings.markup))
  const [creditValue, setCreditValue] = useState(String(settings.credit_value_brl))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await updatePricing({
        usdBrl: parseDecimal(usdBrl),
        fxBuffer: parseDecimal(fxBuffer) / 100,
        markup: parseDecimal(markup),
        creditValueBrl: parseDecimal(creditValue),
      })
      setMessage({ tone: 'success', text: 'Parâmetros salvos. O preço sugerido abaixo já usa os novos valores.' })
      onSaved()
    } catch (saveError) {
      setMessage({ tone: 'error', text: errorMessage(saveError) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <h3 className="text-sm font-bold text-zinc-200">Como o custo vira crédito</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Dólar (R$)" inputMode="decimal" value={usdBrl} onChange={(event) => setUsdBrl(event.target.value)} />
        <TextField label="Folga do câmbio (%)" inputMode="decimal" value={fxBuffer} onChange={(event) => setFxBuffer(event.target.value)} />
        <TextField label="Markup (×)" inputMode="decimal" value={markup} onChange={(event) => setMarkup(event.target.value)} />
        <TextField
          label="Valor do crédito (R$)"
          inputMode="decimal"
          value={creditValue}
          onChange={(event) => setCreditValue(event.target.value)}
          hint="Use o crédito mais barato vendido (plano Studio)."
        />
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" variant="secondary" loading={busy}>
        Salvar parâmetros
      </Button>
    </form>
  )
}

interface ModelRowProps {
  readonly model: AdminModel
  readonly plans: readonly string[]
  readonly settings: PricingSettings
  readonly onSaved: () => void
}

function ModelRow({ model, plans, settings, onSaved }: ModelRowProps) {
  const [active, setActive] = useState(model.active)
  const [credits, setCredits] = useState(String(model.credits))
  const [cost, setCost] = useState(model.provider_cost_usd === null ? '' : String(model.provider_cost_usd))
  const [allowed, setAllowed] = useState<readonly string[]>(model.allowed_plans ?? [])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  const costValue = cost.trim() === '' ? null : parseDecimal(cost)
  const creditsValue = Number.parseInt(credits, 10)
  const margin = costValue !== null && Number.isFinite(costValue) && creditsValue > 0 ? grossMargin(creditsValue, costValue, settings) : null

  function togglePlan(slug: string) {
    setAllowed((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]))
  }

  async function save() {
    if (!Number.isInteger(creditsValue) || creditsValue <= 0) return setMessage({ tone: 'error', text: 'Créditos precisam ser um inteiro positivo.' })
    if (costValue !== null && !Number.isFinite(costValue)) return setMessage({ tone: 'error', text: 'Custo inválido.' })
    setBusy(true)
    setMessage(null)
    try {
      await updateModel(model.slug, { active, credits: creditsValue, providerCostUsd: costValue, allowedPlans: allowed.length > 0 ? allowed : null })
      setMessage({ tone: 'success', text: 'Modelo salvo. Vale para as próximas gerações.' })
      onSaved()
    } catch (saveError) {
      setMessage({ tone: 'error', text: errorMessage(saveError) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="min-w-0 space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <header className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-zinc-100">{model.name}</h3>
        <code className="max-w-full truncate text-xs text-zinc-500">
          {model.provider} · {model.endpoint}
        </code>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Preço (créditos)" inputMode="numeric" value={credits} onChange={(event) => setCredits(event.target.value)} />
        <TextField
          label="Custo real no fornecedor (US$)"
          inputMode="decimal"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          placeholder="Conferir no site do fornecedor"
        />
      </div>
      <p className="text-sm text-zinc-400">
        {costValue === null || !Number.isFinite(costValue) ? (
          'Sem custo cadastrado: a margem não aparece no financeiro.'
        ) : (
          <>
            Sugerido: <span className="font-bold text-zinc-200">{suggestedCredits(costValue, settings)} créditos</span> · margem com o preço atual:{' '}
            <span className={clsx('font-bold', margin !== null && margin < 0.3 ? 'text-red-300' : 'text-accent')}>
              {margin === null ? '–' : `${Math.round(margin * 100)}%`}
            </span>
          </>
        )}
      </p>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-zinc-300">Planos que podem usar (nenhum marcado = todos)</legend>
        <div className="flex flex-wrap gap-3">
          {plans.map((slug) => (
            <label key={slug} className="flex items-center gap-1.5 text-sm text-zinc-300">
              <input type="checkbox" checked={allowed.includes(slug)} onChange={() => togglePlan(slug)} className="size-4 accent-[var(--color-accent)]" />
              {slug}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        Modelo ativo
      </label>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button variant="secondary" loading={busy} onClick={() => void save()}>
        Salvar {model.name}
      </Button>
    </article>
  )
}

export function ModelsTab() {
  const models = useQuery(fetchAdminModels, 'Não deu para carregar os modelos.')
  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  const overview = useQuery(fetchOverview, 'Não deu para carregar os parâmetros de preço.')
  const settings = overview.data?.pricing
  const error = models.error ?? plans.error ?? overview.error

  return (
    <div className="space-y-5">
      {error && <Notice tone="error">{error}</Notice>}
      {settings && <PricingForm key={JSON.stringify(settings)} settings={settings} onSaved={() => void overview.reload()} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {settings &&
          models.data?.map((model) => (
            <ModelRow
              key={`${model.slug}:${model.credits}:${model.provider_cost_usd}:${model.active}`}
              model={model}
              plans={(plans.data ?? []).map((plan) => plan.slug)}
              settings={settings}
              onSaved={() => void models.reload()}
            />
          ))}
      </div>
    </div>
  )
}
