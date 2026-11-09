import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { grossMargin, suggestedCredits, type PricingSettings } from '@/domain/pricing'
import { useToast } from '@/hooks/useToast'
import { updateModel, updatePricing, type AdminModel } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'

const parseDecimal = (value: string) => Number.parseFloat(value.replace(',', '.'))

export function PricingForm({ settings, onSaved }: { readonly settings: PricingSettings; readonly onSaved: () => void }) {
  const [usdBrl, setUsdBrl] = useState(String(settings.usd_brl))
  const [fxBuffer, setFxBuffer] = useState(String(settings.fx_buffer * 100))
  const [markup, setMarkup] = useState(String(settings.markup))
  const [creditValue, setCreditValue] = useState(String(settings.credit_value_brl))
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function review(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setConfirming(true)
  }

  async function save() {
    setBusy(true)
    try {
      await updatePricing({
        usdBrl: parseDecimal(usdBrl),
        fxBuffer: parseDecimal(fxBuffer) / 100,
        markup: parseDecimal(markup),
        creditValueBrl: parseDecimal(creditValue),
      })
      notify('Parâmetros salvos. O preço sugerido abaixo já usa os novos valores.')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form onSubmit={review} className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
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
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary">
        Revisar parâmetros
      </Button>
      <ConfirmDialog open={confirming} title="Salvar parâmetros de preço" confirmLabel="Salvar" busy={busy} onConfirm={() => void save()} onCancel={() => setConfirming(false)}>
        <p>Muda o preço sugerido e a margem calculada de todos os modelos. O preço cobrado em créditos só muda quando você salvar cada modelo.</p>
      </ConfirmDialog>
    </form>
  )
}

interface ModelRowProps {
  readonly model: AdminModel
  readonly plans: readonly string[]
  readonly settings: PricingSettings
  readonly canEdit: boolean
  readonly onSaved: () => void
}

export function ModelRow({ model, plans, settings, canEdit, onSaved }: ModelRowProps) {
  const notify = useToast()
  const [active, setActive] = useState(model.active)
  const [credits, setCredits] = useState(String(model.credits))
  const [cost, setCost] = useState(model.provider_cost_usd === null ? '' : String(model.provider_cost_usd))
  const [allowed, setAllowed] = useState<readonly string[]>(model.allowed_plans ?? [])
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const costValue = cost.trim() === '' ? null : parseDecimal(cost)
  const creditsValue = Number.parseInt(credits, 10)
  const margin = costValue !== null && Number.isFinite(costValue) && creditsValue > 0 ? grossMargin(creditsValue, costValue, settings) : null

  function togglePlan(slug: string) {
    setAllowed((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]))
  }

  function review() {
    if (!Number.isInteger(creditsValue) || creditsValue <= 0) return setError('Créditos precisam ser um inteiro positivo.')
    if (costValue !== null && !Number.isFinite(costValue)) return setError('Custo inválido.')
    setError(null)
    setConfirming(true)
  }

  async function save() {
    setBusy(true)
    try {
      await updateModel(model.slug, { active, credits: creditsValue, providerCostUsd: costValue, allowedPlans: allowed.length > 0 ? allowed : null })
      notify(`${model.name} salvo. Vale para as próximas gerações.`)
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
      setConfirming(false)
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
        <TextField label="Preço (créditos)" inputMode="numeric" value={credits} onChange={(event) => setCredits(event.target.value)} disabled={!canEdit} />
        <TextField
          label="Custo real no fornecedor (US$)"
          inputMode="decimal"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          placeholder="Conferir no site do fornecedor"
          disabled={!canEdit}
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
              <input type="checkbox" checked={allowed.includes(slug)} onChange={() => togglePlan(slug)} disabled={!canEdit} className="size-4 accent-[var(--color-accent)]" />
              {slug}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={!canEdit} className="size-4 accent-[var(--color-accent)]" />
        Modelo ativo
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      {canEdit && (
        <Button variant="secondary" onClick={review}>
          Revisar {model.name}
        </Button>
      )}
      <ConfirmDialog open={confirming} title={`Salvar ${model.name}`} confirmLabel="Salvar modelo" busy={busy} onConfirm={() => void save()} onCancel={() => setConfirming(false)}>
        <p>
          {active ? 'Ativo' : 'Desligado (ninguém gera com ele)'}, {creditsValue} créditos por geração
          {costValue === null ? ', sem custo cadastrado' : `, custo de US$ ${costValue.toFixed(4)}`}, {allowed.length > 0 ? `só ${allowed.join(', ')}` : 'todos os planos'}.
        </p>
        <p className="text-zinc-400">Vale para as próximas gerações; as que já nasceram guardam o preço e o custo da hora.</p>
      </ConfirmDialog>
    </article>
  )
}
