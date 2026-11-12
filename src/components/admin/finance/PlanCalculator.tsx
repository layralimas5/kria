import { useState, type FormEvent } from 'react'
import { formatBRL } from '@/domain/format'
import type { Economics, EconomicsPlan } from '@/domain/planEconomics'
import { usePlanCalculator, type CalculatorDraft } from '@/hooks/usePlanCalculator'
import { useToast } from '@/hooks/useToast'
import { updateDraftPlan } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'
import { Section } from '../dashboard/DashboardSections'
import { Recommendation, ResultsTable, YieldsTable } from './CalculatorResults'
import { formatNumber, formatPercent, formatPoints } from './format'

const STATUS = { draft: 'rascunho', live: 'à venda', legacy: 'antigo' } as const
const CARD = 'space-y-3 card-premium rounded-3xl p-5'

type FieldSpec = readonly [keyof CalculatorDraft, string, 'decimal' | 'numeric', string?]

const PLAN_FIELDS: readonly FieldSpec[] = [
  ['price', 'Preço mensal (R$)', 'decimal'],
  ['credits', 'Créditos mensais', 'numeric'],
  ['exports', 'Exportações por mês', 'numeric', 'Vazio = sem limite.'],
  ['budget', 'Orçamento de IA (R$)', 'decimal', 'Teto interno; o normal é créditos × R$ 0,01.'],
]

const COST_FIELDS: readonly FieldSpec[] = [
  ['avgCost', 'Custo médio por geração (R$)', 'decimal', 'Opcional: estima quantas gerações cabem.'],
  ['usage', 'Utilização esperada (%)', 'decimal'],
  ['fee', 'Taxa do gateway (%)', 'decimal'],
  ['fixedFee', 'Taxa fixa por cobrança (R$)', 'decimal'],
  ['tax', 'Tributos variáveis (%)', 'decimal'],
  ['render', 'Renderização por exportação (R$)', 'decimal', 'Zero enquanto a montagem é no navegador.'],
  ['storage', 'Armazenamento por assinante (R$)', 'decimal'],
  ['transfer', 'Transferência por assinante (R$)', 'decimal'],
  ['other', 'Outros custos variáveis (R$)', 'decimal'],
  ['target', 'Margem de contribuição desejada (%)', 'decimal'],
]

function Fields({ fields, draft, onChange }: { readonly fields: readonly FieldSpec[]; readonly draft: CalculatorDraft; readonly onChange: (field: keyof CalculatorDraft, value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {fields.map(([field, label, mode, hint]) => (
        <TextField key={field} label={label} hint={hint} inputMode={mode} value={draft[field]} onChange={(event) => onChange(field, event.target.value)} />
      ))}
    </div>
  )
}

function PlanEditor({ economics, plan, canSave, onSaved }: { readonly economics: Economics; readonly plan: EconomicsPlan; readonly canSave: boolean; readonly onSaved: () => void }) {
  const notify = useToast()
  const { draft, setField, reset, result } = usePlanCalculator(economics, plan)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savable = canSave && plan.status === 'draft'

  async function save() {
    if (!result) return
    setBusy(true)
    setError(null)
    try {
      await updateDraftPlan({
        slug: plan.slug,
        priceCents: result.input.priceCents,
        monthlyCredits: result.input.monthlyCredits,
        exportsPerMonth: draft.exports.trim() === '' ? null : result.input.exportsPerMonth,
        aiBudgetCents: result.budgetCents,
        reason: reason.trim(),
      })
      notify(`${plan.name} salvo no rascunho. Nada foi publicado.`)
      setReason('')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  function review(event: FormEvent) {
    event.preventDefault()
    if (!result) return
    if (reason.trim().length < 5) return setError('Escreva o motivo da mudança (pelo menos 5 caracteres).')
    setError(null)
    if (result.full.meetsTarget) void save()
    else setConfirming(true)
  }

  return (
    <form onSubmit={review} className="space-y-5">
      <section aria-labelledby="calc-plan" className={CARD}>
        <h3 id="calc-plan" className="text-sm font-bold text-zinc-200">
          {plan.name} <span className="font-normal text-zinc-500">({STATUS[plan.status]})</span>
        </h3>
        <Fields fields={PLAN_FIELDS} draft={draft} onChange={setField} />
        {plan.status !== 'draft' && economics.settings.credit_scale === 1 && (
          <p className="text-xs text-zinc-500">Créditos convertidos para a régua v2 (× fator da virada) para comparar com os planos novos.</p>
        )}
      </section>
      <section aria-labelledby="calc-costs" className={CARD}>
        <h3 id="calc-costs" className="text-sm font-bold text-zinc-200">
          Custos variáveis e meta
        </h3>
        <Fields fields={COST_FIELDS} draft={draft} onChange={setField} />
      </section>

      {!result ? (
        <Notice tone="error">Confira os números: nada negativo, utilização até 100% e meta abaixo de 100%.</Notice>
      ) : (
        <>
          {result.changed && (
            <Notice tone={result.full.meetsTarget ? 'info' : 'error'}>
              Contra o salvo: custo máximo de IA {result.full.aiMaxCents >= result.saved.aiMaxCents ? '+' : ''}
              {formatBRL(Math.round(result.full.aiMaxCents - result.saved.aiMaxCents))} por assinante; margem no uso integral de {formatPercent(result.saved.margin)} para{' '}
              {formatPercent(result.full.margin)}
              {result.full.margin !== null && result.saved.margin !== null && ` (${formatPoints(result.full.margin - result.saved.margin)})`}.
              {!result.full.meetsTarget && ' Fica abaixo da meta.'}
            </Notice>
          )}
          {result.budgetBelowCredits && (
            <Notice tone="error">O orçamento de IA é menor que os créditos × R$ 0,01: no uso integral, o alerta de orçamento vai disparar antes do fim do mês.</Notice>
          )}
          <ResultsTable expected={result.expected} full={result.full} usage={result.usage} target={result.costs.targetMargin} />
          <Recommendation
            fullMeetsTarget={result.full.meetsTarget}
            maxCredits={result.maxCredits}
            minPriceCents={result.minPriceCents}
            credits={result.input.monthlyCredits}
            priceCents={result.input.priceCents}
          />
          <Section title="Gerações por modelo" description="Uma única ferramenta usando todos os créditos do mês, pela cotação v2. Varia com o modelo e a configuração.">
            <YieldsTable yields={result.yields} saved={result.savedYields} />
            {result.expectedGenerations !== null && (
              <p className="text-sm text-zinc-400">Com {formatPercent(result.usage)} de uso, cabem cerca de {formatNumber(result.expectedGenerations)} gerações no custo médio informado.</p>
            )}
          </Section>
        </>
      )}

      {savable ? (
        <div className="space-y-3 rounded-3xl border border-white/[0.08] bg-surface p-5">
          <TextField label="Motivo da mudança" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy} disabled={!result}>
              Salvar no rascunho
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Voltar ao salvo
            </Button>
          </div>
          <p className="text-xs text-zinc-500">Salva só o rascunho. Nada vai à vitrine nem ao checkout até a virada aprovada.</p>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          {plan.status === 'draft' ? 'Sua permissão só simula.' : 'Plano no ar: aqui é só simulação. Ele muda pela virada, nunca por esta tela.'}
        </p>
      )}
      <ConfirmDialog open={confirming} title="Salvar abaixo da meta?" confirmLabel="Salvar mesmo assim" busy={busy} onConfirm={() => void save()} onCancel={() => setConfirming(false)}>
        <p>
          No uso integral, {plan.name} fica com {formatPercent(result?.full.margin ?? null)} de margem, abaixo da meta de {formatPercent(result?.costs.targetMargin ?? null)}.
        </p>
        <p className="text-zinc-400">O rascunho salva, mas a virada vai pedir aceite explícito e a permissão de exceção do dono.</p>
      </ConfirmDialog>
    </form>
  )
}

/** Admin → Financeiro → Calculadora de planos e créditos. Simula antes de salvar; só rascunho salva. */
export function PlanCalculator({ economics, canSave, onSaved }: { readonly economics: Economics; readonly canSave: boolean; readonly onSaved: () => void }) {
  const plans = economics.plans.filter((plan) => plan.price_cents > 0 && (plan.status !== 'legacy' || plan.line === 'creator'))
  const [slug, setSlug] = useState(plans.find((plan) => plan.slug === 'creator-pro')?.slug ?? plans[0]?.slug ?? '')
  const plan = plans.find((item) => item.slug === slug)
  if (!plan) return <Notice>Nenhum plano pago para calcular.</Notice>
  return (
    <div className="space-y-5">
      <Notice>Simulação: nada muda até salvar, e só plano em rascunho salva. Créditos aqui são sempre na régua v2 (R$ 0,01 de orçamento por crédito).</Notice>
      <div className="max-w-sm">
        <SelectField label="Plano" value={slug} onChange={setSlug} options={plans.map((item) => ({ value: item.slug, label: `${item.name} (${STATUS[item.status]})` }))} />
      </div>
      <PlanEditor key={`${plan.slug}:${plan.price_cents}:${plan.monthly_credits}:${plan.ai_budget_cents}`} economics={economics} plan={plan} canSave={canSave} onSaved={onSaved} />
    </div>
  )
}
