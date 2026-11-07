import { useState, type FormEvent } from 'react'
import type { FinanceSettings } from '@/domain/finance'
import { useToast } from '@/hooks/useToast'
import { updateFinanceSettings } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { moneyInput, parseMoneyCents, parsePercent, percentInput } from './inputs'

type Draft = Record<keyof FinanceSettings, string>

const MONEY_FIELDS = ['fixed_costs_cents', 'infra_costs_cents', 'storage_costs_cents', 'render_cost_cents_per_export', 'pro_labore_cents'] as const
const RATE_FIELDS = ['tax_rate', 'reserve_rate', 'min_margin_rate'] as const

const LABELS: Record<keyof FinanceSettings, { readonly label: string; readonly hint: string }> = {
  tax_rate: { label: 'Tributos (% da receita)', hint: 'Simples Nacional começa perto de 6%. Confirme com a contabilidade.' },
  fixed_costs_cents: { label: 'Despesas fixas por mês (R$)', hint: 'Ferramentas, contador, domínio.' },
  infra_costs_cents: { label: 'Infraestrutura por mês (R$)', hint: 'Supabase, hospedagem, e-mail.' },
  storage_costs_cents: { label: 'Armazenamento por mês (R$)', hint: 'Excedente de storage e transferência.' },
  render_cost_cents_per_export: { label: 'Custo por exportação (R$)', hint: 'Zero enquanto a montagem roda no navegador.' },
  pro_labore_cents: { label: 'Pró-labore por mês (R$)', hint: 'Sai antes do lucro distribuível.' },
  reserve_rate: { label: 'Reserva (% do resultado)', hint: 'Fica no caixa antes de distribuir.' },
  min_margin_rate: { label: 'Margem mínima (%)', hint: 'Abaixo disso o painel alerta.' },
}

function toDraft(settings: FinanceSettings): Draft {
  return {
    tax_rate: percentInput(settings.tax_rate),
    fixed_costs_cents: moneyInput(settings.fixed_costs_cents),
    infra_costs_cents: moneyInput(settings.infra_costs_cents),
    storage_costs_cents: moneyInput(settings.storage_costs_cents),
    render_cost_cents_per_export: moneyInput(settings.render_cost_cents_per_export),
    pro_labore_cents: moneyInput(settings.pro_labore_cents),
    reserve_rate: percentInput(settings.reserve_rate),
    min_margin_rate: percentInput(settings.min_margin_rate),
  }
}

function fromDraft(draft: Draft): FinanceSettings | null {
  const money = Object.fromEntries(MONEY_FIELDS.map((key) => [key, parseMoneyCents(draft[key])]))
  const rates = Object.fromEntries(RATE_FIELDS.map((key) => [key, parsePercent(draft[key])]))
  const settings = { ...money, ...rates } as FinanceSettings
  const valid =
    MONEY_FIELDS.every((key) => Number.isFinite(settings[key])) &&
    settings.tax_rate >= 0 && settings.tax_rate <= 0.5 &&
    settings.reserve_rate >= 0 && settings.reserve_rate <= 0.9 &&
    settings.min_margin_rate >= 0 && settings.min_margin_rate <= 0.95
  return valid ? settings : null
}

/** Premissas do resultado. Só quem tem `pricing.manage` salva; vale para todos os períodos. */
export function FinanceSettingsForm({ settings, canEdit, onSaved }: { readonly settings: FinanceSettings; readonly canEdit: boolean; readonly onSaved: () => void }) {
  const notify = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const parsed = fromDraft(draft)
    if (!parsed) return setError('Confira os valores: reais sem sinal negativo, tributos até 50%, reserva até 90%, margem até 95%.')
    setBusy(true)
    setError(null)
    try {
      await updateFinanceSettings(parsed)
      notify('Premissas salvas. O resultado foi recalculado.')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <div>
        <h3 className="text-sm font-bold text-zinc-200">Premissas do resultado</h3>
        <p className="mt-1 text-sm text-zinc-400">Estimativas até existir fatura e contabilidade reais. Valores mensais.</p>
      </div>
      <fieldset disabled={!canEdit || busy} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Premissas</legend>
        {(Object.keys(LABELS) as (keyof FinanceSettings)[]).map((key) => (
          <TextField
            key={key}
            label={LABELS[key].label}
            hint={LABELS[key].hint}
            inputMode="decimal"
            value={draft[key]}
            onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
          />
        ))}
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      {canEdit ? (
        <Button type="submit" variant="secondary" loading={busy}>
          Salvar premissas
        </Button>
      ) : (
        <p className="text-xs text-zinc-500">Só quem altera preços salva as premissas.</p>
      )}
    </form>
  )
}
