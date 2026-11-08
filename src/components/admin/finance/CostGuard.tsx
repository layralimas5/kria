import { useState, type FormEvent } from 'react'
import type { ModelQuotes } from '@/domain/creditPolicy'
import { useToast } from '@/hooks/useToast'
import { runPriceCheck, updateCostGuard, type PriceCheck } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { formatUsd } from './format'
import { parseDecimal, parsePercent, percentInput } from './inputs'

const decimal = (value: number) => String(value).replace('.', ',')
const int = (value: string) => (/^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : Number.NaN)

/** Teto por operação, boas-vindas da virada, teto de contas novas por dia e tolerância da checagem de preço. */
export function CostGuardForm({ quotes, onSaved }: { readonly quotes: ModelQuotes; readonly onSaved: () => void }) {
  const notify = useToast()
  const { settings } = quotes
  const [cap, setCap] = useState(decimal(settings.max_operation_cost_usd))
  const [welcome, setWelcome] = useState(String(settings.next_welcome_credits))
  const [daily, setDaily] = useState(String(settings.welcome_daily_cap))
  const [tolerance, setTolerance] = useState(percentInput(settings.price_drift_tolerance))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const update = { maxOperationCostUsd: parseDecimal(cap), nextWelcomeCredits: int(welcome), welcomeDailyCap: int(daily), priceDriftTolerance: parsePercent(tolerance) }
    if (!(update.maxOperationCostUsd > 0) || !(update.nextWelcomeCredits >= 0 && update.nextWelcomeCredits <= 1000) || !(update.welcomeDailyCap >= 0) || !(update.priceDriftTolerance >= 0 && update.priceDriftTolerance <= 0.5)) {
      return setError('Teto positivo, boas-vindas de 0 a 1.000, teto diário inteiro e tolerância de 0 a 50%.')
    }
    setBusy(true)
    setError(null)
    try {
      await updateCostGuard(update)
      notify('Proteções salvas.')
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
        <TextField label="Teto por operação (US$)" hint="Acima disso o modelo não gera, com crédito ou sem." inputMode="decimal" value={cap} onChange={(event) => setCap(event.target.value)} />
        <TextField
          label="Boas-vindas na virada (créditos v2)"
          hint={settings.credit_scale === 2 ? 'Já aplicado na virada.' : `Hoje vale ${settings.welcome_credits} na escala atual.`}
          inputMode="numeric"
          disabled={settings.credit_scale === 2}
          value={welcome}
          onChange={(event) => setWelcome(event.target.value)}
        />
        <TextField label="Contas novas com boas-vindas por dia" hint="Freio contra cadastro em massa." inputMode="numeric" value={daily} onChange={(event) => setDaily(event.target.value)} />
        <TextField label="Tolerância da checagem de preço (%)" inputMode="decimal" value={tolerance} onChange={(event) => setTolerance(event.target.value)} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" loading={busy}>
        Salvar proteções
      </Button>
    </form>
  )
}

/** Consulta a API de preço do fal (sem gerar nada). Preço mudado tira o modelo do ar até rever a tarifa. */
export function PriceCheckCard({ onChecked }: { readonly onChecked: () => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PriceCheck | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    setBusy(true)
    setError(null)
    try {
      setResult(await runPriceCheck())
      onChecked()
    } catch (checkError) {
      setError(errorMessage(checkError))
    } finally {
      setBusy(false)
    }
  }

  const changed = result?.checked.filter((row) => !row.matches) ?? []
  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" loading={busy} onClick={() => void check()}>
        Conferir preços no fal agora
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <Notice tone={changed.length > 0 ? 'error' : 'success'}>
          {changed.length > 0
            ? `Preço mudou em ${changed.map((row) => `${row.slug} (fornecedor ${formatUsd(row.observed)})`).join(', ')}. Esses modelos ficam sem custo confiável até a tarifa ser revista.`
            : `${result.checked.length} modelos conferidos: preços iguais aos guardados.`}
          {result.missing.length > 0 && ` Sem resposta do fal para: ${result.missing.join(', ')}.`}
        </Notice>
      )}
      <p className="text-xs text-zinc-500">A API do fal devolve o preço base por unidade. Anthropic não tem consulta de preço: confira a página e salve a tarifa.</p>
    </div>
  )
}
