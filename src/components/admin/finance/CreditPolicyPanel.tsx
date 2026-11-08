import { useState, type FormEvent } from 'react'
import { operationSpecs, type ModelQuote, type ModelQuotes, type Tariff } from '@/domain/creditPolicy'
import { formatDateTime } from '@/domain/format'
import { useToast } from '@/hooks/useToast'
import { confirmModelCost, updateCreditPolicy } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'
import { Section } from '../dashboard/DashboardSections'
import { ActivationPanel } from './ActivationPanel'
import { CostGuardForm, PriceCheckCard } from './CostGuard'
import { DataTable, type Column } from './DataTable'
import { formatBrlValue, formatNumber, formatUsd } from './format'
import { parseDecimal } from './inputs'
import { TariffForm } from './TariffForm'

function tariffText(tariff: Tariff | null): string {
  if (!tariff) return 'Sem tarifa'
  if (tariff.unit === 'image') return `${formatUsd(tariff.usd)} por imagem`
  if (tariff.unit === 'second') return `${formatUsd(tariff.usd)}/s${tariff.usd_audio ? ` · ${formatUsd(tariff.usd_audio)}/s com áudio` : ''}`
  return `US$ ${tariff.input_usd_per_mtok} / ${tariff.output_usd_per_mtok} por milhão${tariff.est_input_tokens === null ? ' · volume não medido' : ''}`
}

function TrustLabel({ quote }: { readonly quote: ModelQuote }) {
  if (quote.cost_drift_at) return <span className="text-red-300" title={quote.cost_drift_note ?? undefined}>Preço mudou no fornecedor</span>
  if (quote.trusted) return <span className="text-accent-soft">Confiável</span>
  if (quote.provider_cost_usd === null) return <span className="text-red-300">Sem custo</span>
  return <span className="text-hot">{quote.cost_checked_at ? `Vencido (${formatDateTime(quote.cost_checked_at)})` : 'Cadastrado, conferir'}</span>
}

function QuotesTable({ quotes }: { readonly quotes: ModelQuotes }) {
  const legacy = quotes.settings.credit_scale === 1
  const columns: Column<ModelQuote>[] = [
    {
      key: 'name',
      label: 'Modelo',
      render: (quote) => (
        <span>
          <span className="block font-semibold text-zinc-100">{quote.name}</span>
          <span className="block text-xs text-zinc-500">{[quote.provider, quote.endpoint, operationSpecs(quote.defaults)].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { key: 'tariff', label: 'Tarifa', render: (quote) => <span className="text-xs">{tariffText(quote.pricing)}</span> },
    { key: 'cost', label: 'Por operação', align: 'right', render: (quote) => formatUsd(quote.provider_cost_usd) },
    { key: 'trust', label: 'Custo', render: (quote) => <TrustLabel quote={quote} /> },
    { key: 'protected', label: 'Com segurança', align: 'right', render: (quote) => (quote.provider_cost_usd === null ? '–' : formatBrlValue(quote.protected_brl)) },
    { key: 'credits', label: legacy ? 'Créditos hoje' : 'Créditos cobrados', align: 'right', render: (quote) => formatNumber(quote.credits) },
    {
      key: 'quoted',
      label: legacy ? 'Créditos v2' : 'Cotação atual',
      align: 'right',
      render: (quote) => (quote.provider_cost_usd === null ? <span className="text-zinc-500">sem cotação</span> : <span className="font-semibold text-zinc-100">{formatNumber(quote.quoted_credits)}</span>),
    },
  ]
  return (
    <DataTable
      caption="Cotação por modelo"
      rows={quotes.models}
      columns={columns}
      rowKey={(quote) => quote.slug}
      rowTone={(quote) => (quote.active && !quote.trusted ? 'bad' : undefined)}
      empty="Nenhum modelo cadastrado."
    />
  )
}

function ConfirmCostForm({ quotes, onSaved }: { readonly quotes: ModelQuotes; readonly onSaved: () => void }) {
  const notify = useToast()
  const withCost = quotes.models.filter((quote) => quote.provider_cost_usd !== null && !quote.cost_drift_at)
  const [slug, setSlug] = useState(withCost[0]?.slug ?? '')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (withCost.length === 0) return <p className="text-sm text-zinc-500">Cadastre a tarifa acima para confirmar a conferência aqui.</p>

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await confirmModelCost(slug, source)
      notify('Conferência registrada com a fonte.')
      setSource('')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end">
      <SelectField label="Modelo" value={slug} onChange={setSlug} options={withCost.map((quote) => ({ value: quote.slug, label: quote.name }))} />
      <TextField label="Fonte do preço" placeholder="https://fal.ai/models/..." value={source} maxLength={300} onChange={(event) => setSource(event.target.value)} />
      <Button type="submit" variant="secondary" loading={busy}>
        Confirmar preço
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  )
}

function PolicyForm({ quotes, onSaved }: { readonly quotes: ModelQuotes; readonly onSaved: () => void }) {
  const notify = useToast()
  const { settings } = quotes
  const [safety, setSafety] = useState(String(settings.safety_factor).replace('.', ','))
  const [budget, setBudget] = useState(String(settings.credit_budget_brl).replace('.', ','))
  const [legacyCost, setLegacyCost] = useState(String(settings.legacy_cost_per_credit_brl).replace('.', ','))
  const [stale, setStale] = useState(String(settings.cost_stale_days))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const update = {
      safetyFactor: parseDecimal(safety),
      creditBudgetBrl: parseDecimal(budget),
      legacyCostPerCreditBrl: parseDecimal(legacyCost),
      costStaleDays: Number.parseInt(stale, 10),
    }
    if (!(update.safetyFactor >= 1 && update.safetyFactor <= 3) || !(update.creditBudgetBrl > 0) || !(update.legacyCostPerCreditBrl > 0) || !(update.costStaleDays >= 1 && update.costStaleDays <= 365)) {
      return setError('Fator de 1 a 3, valores positivos e prazo de 1 a 365 dias.')
    }
    setBusy(true)
    setError(null)
    try {
      await updateCreditPolicy(update)
      notify('Política de crédito salva. A cotação foi refeita.')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TextField label="Fator de segurança" hint="Reserva de custo, não margem de lucro." inputMode="decimal" value={safety} onChange={(event) => setSafety(event.target.value)} />
        <TextField
          label="Orçamento por crédito (R$)"
          hint={settings.credit_scale === 2 ? 'Travado depois da virada.' : 'Nunca aparece para o cliente.'}
          inputMode="decimal"
          disabled={settings.credit_scale === 2}
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
        />
        <TextField label="Custo do crédito atual (R$)" hint="Base do fator da virada." inputMode="decimal" value={legacyCost} onChange={(event) => setLegacyCost(event.target.value)} />
        <TextField label="Conferência vale por (dias)" inputMode="numeric" value={stale} onChange={(event) => setStale(event.target.value)} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" loading={busy}>
        Salvar política
      </Button>
    </form>
  )
}

/** Motor de preço: tarifa oficial por modelo, cotação v2, proteções e a virada. */
export function CreditPolicyPanel({ quotes, canManage, onChanged }: { readonly quotes: ModelQuotes; readonly canManage: boolean; readonly onChanged: () => void }) {
  const { settings } = quotes
  const untrusted = quotes.models.filter((quote) => quote.active && !quote.trusted)
  return (
    <div className="space-y-8">
      {settings.credit_scale === 2 && settings.scale_activated_at ? (
        <Notice>
          Preços novos ligados em {formatDateTime(settings.scale_activated_at)}. Conta nova ganha {settings.welcome_credits} créditos. Trava de custo{' '}
          {settings.require_trusted_cost ? 'ligada' : 'desligada'}: modelo sem custo confiável não gera.
        </Notice>
      ) : (
        <Notice>
          Escala atual em uso. "Créditos v2" é quanto cada operação vai custar depois da virada: custo da tarifa × câmbio ({settings.usd_brl.toLocaleString('pt-BR')}) × segurança (
          {settings.safety_factor.toLocaleString('pt-BR')}) ÷ R$ {settings.credit_budget_brl.toLocaleString('pt-BR')} por crédito. Sem tarifa, não há cotação.
        </Notice>
      )}
      {untrusted.length > 0 && (
        <Notice tone="error">
          {untrusted.length} {untrusted.length === 1 ? 'modelo ativo está' : 'modelos ativos estão'} sem custo confiável: {untrusted.map((quote) => quote.name).join(', ')}.{' '}
          {settings.require_trusted_cost ? 'Eles não geram até a tarifa ser conferida.' : 'A virada fica travada até conferir ou desligar.'}
        </Notice>
      )}
      <Section title="Cotação por modelo" description={`Conferência vale ${settings.cost_stale_days} dias. Pedido já autorizado mantém o custo e os créditos gravados; mudança vale para os novos.`}>
        <QuotesTable quotes={quotes} />
      </Section>
      {canManage && (
        <>
          <Section title="Tarifa do fornecedor" description="Preço oficial na unidade do fornecedor. Salvar registra a fonte e confere hoje.">
            <TariffForm quotes={quotes} onSaved={onChanged} />
          </Section>
          <Section title="Conferir sem mudar a tarifa" description="Para tarifa já cadastrada que você conferiu na página do fornecedor.">
            <ConfirmCostForm quotes={quotes} onSaved={onChanged} />
          </Section>
          <Section title="Preço no fornecedor">
            <PriceCheckCard onChecked={onChanged} />
          </Section>
          <Section title="Proteções">
            <CostGuardForm key={JSON.stringify(settings)} quotes={quotes} onSaved={onChanged} />
          </Section>
          <Section title="Política de crédito">
            <PolicyForm key={JSON.stringify(settings)} quotes={quotes} onSaved={onChanged} />
          </Section>
          {/* Tarifa, conferência ou proteção nova mudam a checagem: a chave refaz a consulta. */}
          <ActivationPanel key={JSON.stringify(quotes)} quotes={quotes} onChanged={onChanged} />
        </>
      )}
    </div>
  )
}
