import { useState, type FormEvent } from 'react'
import { operationSpecs, scaleFactor, welcomeCovers, type ModelQuote, type ModelQuotes } from '@/domain/creditPolicy'
import { formatDateTime } from '@/domain/format'
import { useToast } from '@/hooks/useToast'
import { activatePricingV2, confirmModelCost, updateCreditPolicy } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'
import { Section } from '../dashboard/DashboardSections'
import { DataTable, type Column } from './DataTable'
import { parseDecimal } from './inputs'

const brl = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usd = (value: number | null) => (value === null ? 'sem custo' : `US$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`)
const number = (value: number) => value.toLocaleString('pt-BR')

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
    { key: 'cost', label: 'Preço do fornecedor', align: 'right', render: (quote) => usd(quote.provider_cost_usd) },
    {
      key: 'checked',
      label: 'Conferido',
      render: (quote) =>
        quote.cost_checked_at ? (
          <span className={quote.stale ? 'text-hot' : undefined}>{formatDateTime(quote.cost_checked_at)}</span>
        ) : (
          <span className="text-hot">Nunca</span>
        ),
    },
    { key: 'estimated', label: 'Custo estimado', align: 'right', render: (quote) => brl(quote.estimated_brl) },
    { key: 'protected', label: 'Com segurança', align: 'right', render: (quote) => brl(quote.protected_brl) },
    { key: 'credits', label: legacy ? 'Créditos hoje' : 'Créditos cobrados', align: 'right', render: (quote) => number(quote.credits) },
    {
      key: 'quoted',
      label: legacy ? 'Créditos v2' : 'Cotação atual',
      align: 'right',
      render: (quote) => <span className="font-semibold text-zinc-100">{number(quote.quoted_credits)}</span>,
    },
    { key: 'basis', label: 'Base', render: (quote) => (quote.basis === 'provider_cost' ? 'Custo cadastrado' : 'Estimativa pelo crédito atual') },
  ]
  return (
    <DataTable
      caption="Cotação por modelo"
      rows={quotes.models}
      columns={columns}
      rowKey={(quote) => quote.slug}
      rowTone={(quote) => (!legacy && quote.quoted_credits > quote.credits ? 'bad' : undefined)}
      empty="Nenhum modelo cadastrado."
    />
  )
}

function ConfirmCostForm({ quotes, onSaved }: { readonly quotes: ModelQuotes; readonly onSaved: () => void }) {
  const notify = useToast()
  const withCost = quotes.models.filter((quote) => quote.provider_cost_usd !== null)
  const [slug, setSlug] = useState(withCost[0]?.slug ?? '')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (withCost.length === 0) {
    return <p className="text-sm text-zinc-500">Cadastre o custo do fornecedor em Modelos e custos para confirmar a conferência aqui.</p>
  }

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
        <TextField label="Custo do crédito atual (R$)" hint="Base sem custo cadastrado." inputMode="decimal" value={legacyCost} onChange={(event) => setLegacyCost(event.target.value)} />
        <TextField label="Alerta de preço após (dias)" inputMode="numeric" value={stale} onChange={(event) => setStale(event.target.value)} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" loading={busy}>
        Salvar política
      </Button>
    </form>
  )
}

function ActivationCard({ quotes, onDone }: { readonly quotes: ModelQuotes; readonly onDone: () => void }) {
  const notify = useToast()
  const [welcome, setWelcome] = useState('10')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const factor = scaleFactor(quotes.settings)
  const welcomeCredits = Number.parseInt(welcome, 10)
  const covers = Number.isInteger(welcomeCredits) ? welcomeCovers(welcomeCredits, quotes.models) : null

  async function activate() {
    setBusy(true)
    try {
      const result = await activatePricingV2(welcomeCredits, reason.trim())
      notify(`Preços v2 ligados. ${result.wallets} saldos convertidos pelo fator ${result.factor.toLocaleString('pt-BR')}.`)
      onDone()
    } catch (activateError) {
      setError(errorMessage(activateError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  function review(event: FormEvent) {
    event.preventDefault()
    if (!Number.isInteger(welcomeCredits) || welcomeCredits < 0 || welcomeCredits > 1000) return setError('Boas-vindas vai de 0 a 1.000 créditos.')
    if (reason.trim().length < 10) return setError('Escreva o motivo da virada (pelo menos 10 caracteres).')
    setError(null)
    setConfirming(true)
  }

  return (
    <form onSubmit={review} className="space-y-4 rounded-3xl border border-hot/30 bg-surface p-5">
      <div>
        <h3 className="text-sm font-bold text-zinc-100">Ligar os preços v2</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Converte tudo pelo fator {factor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}: cada saldo, pacote, assinatura e plano atual passa a valer o mesmo em
          créditos v2. Os modelos assumem a coluna "Créditos v2". Starter, Pro e Studio saem da vitrine e seguem para quem já assina. Creator Start, Pro e Max entram à venda.
          Business continua em rascunho. Não tem volta pelo painel.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-400">
        <li>Pause as gerações na Guarda de gasto (Modelos e custos).</li>
        <li>Publique o front desta versão junto, para a vitrine mostrar os planos novos.</li>
      </ol>
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <TextField label="Boas-vindas (créditos v2)" inputMode="numeric" value={welcome} onChange={(event) => setWelcome(event.target.value)} />
        <TextField label="Motivo" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
      </div>
      {Number.isInteger(welcomeCredits) && (
        <Notice tone={covers ? 'info' : 'error'}>
          {covers
            ? `Com ${welcomeCredits} créditos, a conta nova consegue ao menos ${covers.name} (${covers.quoted_credits} créditos).`
            : `Com ${welcomeCredits} créditos, a conta nova não consegue gerar nada: a operação mais barata custa ${Math.min(...quotes.models.map((quote) => quote.quoted_credits))} créditos.`}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit">Revisar virada</Button>
      <ConfirmDialog open={confirming} title="Ligar os preços v2" confirmLabel="Ligar agora" busy={busy} onConfirm={() => void activate()} onCancel={() => setConfirming(false)}>
        <p>Saldos, pacotes e assinaturas atuais serão multiplicados por {factor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}. Conta nova ganha {welcomeCredits} créditos.</p>
        <p className="text-zinc-400">A conversão fica no extrato de cada conta e na auditoria. Confirme que o front novo vai ao ar junto.</p>
      </ConfirmDialog>
    </form>
  )
}

/** Cotação por custo (escala v2), conferência de preço, política e a virada. */
export function CreditPolicyPanel({ quotes, canManage, onChanged }: { readonly quotes: ModelQuotes; readonly canManage: boolean; readonly onChanged: () => void }) {
  const { settings } = quotes
  const stale = quotes.models.filter((quote) => quote.active && quote.stale)
  return (
    <div className="space-y-8">
      {settings.credit_scale === 2 && settings.scale_activated_at ? (
        <Notice>Preços v2 ligados em {formatDateTime(settings.scale_activated_at)}. Conta nova ganha {settings.welcome_credits} créditos.</Notice>
      ) : (
        <Notice>
          Escala atual em uso. A coluna "Créditos v2" mostra quanto cada operação vai custar quando os preços v2 forem ligados: custo × câmbio ({settings.usd_brl.toLocaleString('pt-BR')}) ×
          segurança ({settings.safety_factor.toLocaleString('pt-BR')}) ÷ R$ {settings.credit_budget_brl.toLocaleString('pt-BR')} por crédito.
        </Notice>
      )}
      {stale.length > 0 && (
        <Notice tone="error">
          {stale.length} {stale.length === 1 ? 'modelo ativo está' : 'modelos ativos estão'} sem preço conferido nos últimos {settings.cost_stale_days} dias. Cadastre o custo em Modelos e custos
          e confirme a fonte abaixo.
        </Notice>
      )}
      <Section title="Cotação por modelo" description="Sem custo cadastrado, a base é o preço atual × custo médio do crédito atual. É estimativa, não preço do fornecedor.">
        <QuotesTable quotes={quotes} />
      </Section>
      {canManage && (
        <>
          <Section title="Conferência de preço" description="Registra a data e o link de onde o preço do fornecedor foi conferido.">
            <ConfirmCostForm quotes={quotes} onSaved={onChanged} />
          </Section>
          <Section title="Política de crédito">
            <PolicyForm key={JSON.stringify(settings)} quotes={quotes} onSaved={onChanged} />
          </Section>
          {settings.credit_scale === 1 && <ActivationCard quotes={quotes} onDone={onChanged} />}
        </>
      )}
    </div>
  )
}
