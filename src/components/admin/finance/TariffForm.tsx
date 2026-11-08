import { useState, type FormEvent } from 'react'
import { quoteCredits, tariffCostUsd, type ModelQuote, type ModelQuotes, type Tariff } from '@/domain/creditPolicy'
import { useToast } from '@/hooks/useToast'
import { setModelTariff } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'
import { formatNumber, formatUsd } from './format'
import { parseDecimal } from './inputs'

interface TariffDraft {
  readonly usd: string
  readonly usdAudio: string
  readonly multipliers: string
  readonly input: string
  readonly output: string
  readonly estInput: string
  readonly estOutput: string
  readonly source: string
}

const decimal = (value: number | undefined | null) => (value === undefined || value === null ? '' : String(value).replace('.', ','))

function draftOf(model: ModelQuote): TariffDraft {
  const tariff = model.pricing
  const measuredIn = model.avg_input_tokens === null ? '' : String(model.avg_input_tokens)
  const measuredOut = model.max_output_tokens === null ? '' : String(model.max_output_tokens)
  return {
    usd: tariff && tariff.unit !== 'token' ? decimal(tariff.usd) : '',
    usdAudio: tariff?.unit === 'second' ? decimal(tariff.usd_audio) : '',
    multipliers:
      tariff?.unit === 'image' && tariff.resolution_multipliers
        ? Object.entries(tariff.resolution_multipliers)
            .map(([size, factor]) => `${size}=${decimal(factor)}`)
            .join('; ')
        : '',
    input: tariff?.unit === 'token' ? decimal(tariff.input_usd_per_mtok) : '',
    output: tariff?.unit === 'token' ? decimal(tariff.output_usd_per_mtok) : '',
    estInput: tariff?.unit === 'token' && tariff.est_input_tokens !== null ? String(tariff.est_input_tokens) : measuredIn,
    estOutput: tariff?.unit === 'token' && tariff.est_output_tokens !== null ? String(tariff.est_output_tokens) : measuredOut,
    source: model.cost_source ?? '',
  }
}

function parseMultipliers(value: string): Record<string, number> | null | undefined {
  if (value.trim() === '') return undefined
  const entries = value.split(';').map((pair) => pair.split('=').map((part) => part.trim()))
  const parsed = entries.map(([size, factor]) => [size ?? '', parseDecimal(factor ?? '')] as const)
  if (parsed.some(([size, factor]) => size === '' || !(factor > 0))) return null
  return Object.fromEntries(parsed)
}

const positive = (value: string) => {
  const parsed = parseDecimal(value)
  return parsed > 0 ? parsed : null
}
const tokens = (value: string) => (/^\d+$/.test(value.trim()) && Number(value) > 0 ? Number(value) : null)

/** Monta a tarifa pelo tipo do modelo; nulo quando falta valor obrigatório. */
function tariffFrom(kind: ModelQuote['kind'], draft: TariffDraft): Tariff | null {
  if (kind === 'text') {
    const input = positive(draft.input)
    const output = positive(draft.output)
    if (input === null || output === null) return null
    return { unit: 'token', input_usd_per_mtok: input, output_usd_per_mtok: output, est_input_tokens: tokens(draft.estInput), est_output_tokens: tokens(draft.estOutput) }
  }
  const usd = positive(draft.usd)
  if (usd === null) return null
  if (kind === 'video') {
    const audio = draft.usdAudio.trim() === '' ? undefined : positive(draft.usdAudio)
    if (audio === null) return null
    return audio === undefined ? { unit: 'second', usd } : { unit: 'second', usd, usd_audio: audio }
  }
  const multipliers = parseMultipliers(draft.multipliers)
  if (multipliers === null) return null
  return multipliers === undefined ? { unit: 'image', usd } : { unit: 'image', usd, resolution_multipliers: multipliers }
}

function Editor({ model, quotes, onSaved }: { readonly model: ModelQuote; readonly quotes: ModelQuotes; readonly onSaved: () => void }) {
  const notify = useToast()
  const [draft, setDraft] = useState(() => draftOf(model))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (field: keyof TariffDraft) => (event: { target: { value: string } }) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  const tariff = tariffFrom(model.kind, draft)
  const cost = tariff ? tariffCostUsd(tariff, model.defaults) : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!tariff) return setError('Preencha a tarifa com valores positivos.')
    if (draft.source.trim().length < 5) return setError('Cole o link da página de preço do fornecedor.')
    setBusy(true)
    setError(null)
    try {
      await setModelTariff(model.slug, tariff, draft.source.trim())
      notify(cost === null ? 'Tarifa salva. O custo por operação ainda depende do volume de tokens.' : 'Tarifa salva e conferida hoje.')
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
        {model.kind === 'text' ? (
          <>
            <TextField label="Entrada (US$ por milhão)" inputMode="decimal" value={draft.input} onChange={set('input')} />
            <TextField label="Saída (US$ por milhão)" inputMode="decimal" value={draft.output} onChange={set('output')} />
            <TextField
              label="Tokens de entrada por operação"
              hint={model.avg_input_tokens === null ? 'Ainda sem medição real.' : `Média medida: ${formatNumber(model.avg_input_tokens)}.`}
              inputMode="numeric"
              value={draft.estInput}
              onChange={set('estInput')}
            />
            <TextField
              label="Tokens de saída por operação"
              hint={model.max_output_tokens === null ? 'Ainda sem medição real.' : `Maior medido: ${formatNumber(model.max_output_tokens)} (média ${formatNumber(model.avg_output_tokens ?? 0)}).`}
              inputMode="numeric"
              value={draft.estOutput}
              onChange={set('estOutput')}
            />
          </>
        ) : (
          <>
            <TextField label={model.kind === 'video' ? 'US$ por segundo, sem áudio' : 'US$ por imagem'} inputMode="decimal" value={draft.usd} onChange={set('usd')} />
            {model.kind === 'video' ? (
              <TextField label="US$ por segundo, com áudio" hint="Vazio se o modelo não tem áudio." inputMode="decimal" value={draft.usdAudio} onChange={set('usdAudio')} />
            ) : (
              <TextField label="Multiplicador por resolução" hint="Ex.: 1K=1; 2K=1,5; 4K=2" value={draft.multipliers} onChange={set('multipliers')} />
            )}
          </>
        )}
      </div>
      <TextField label="Fonte do preço" placeholder="https://fal.ai/models/..." value={draft.source} maxLength={300} onChange={set('source')} />
      <Notice tone={tariff && cost !== null ? 'info' : 'error'}>
        {!tariff
          ? 'Tarifa incompleta.'
          : cost === null
            ? 'Com essa tarifa o custo por operação não fecha (falta volume de tokens ou a configuração do modelo pede outro valor). O modelo segue sem custo confiável.'
            : `Configuração do modelo: ${formatUsd(cost)} por operação = ${formatNumber(quoteCredits(cost, quotes.settings))} créditos v2 (hoje: ${formatNumber(model.quoted_credits)}).`}
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" loading={busy}>
        Salvar tarifa e conferir hoje
      </Button>
    </form>
  )
}

/** Tarifa oficial do fornecedor por modelo. Salvar confere a data; depois da virada, recalcula os créditos dos pedidos novos. */
export function TariffForm({ quotes, onSaved }: { readonly quotes: ModelQuotes; readonly onSaved: () => void }) {
  const [slug, setSlug] = useState(quotes.models[0]?.slug ?? '')
  const model = quotes.models.find((item) => item.slug === slug)
  return (
    <div className="space-y-3">
      <div className="max-w-sm">
        <SelectField label="Modelo" value={slug} onChange={setSlug} options={quotes.models.map((item) => ({ value: item.slug, label: item.name }))} />
      </div>
      {model && <Editor key={`${model.slug}:${JSON.stringify(model.pricing)}`} model={model} quotes={quotes} onSaved={onSaved} />}
    </div>
  )
}
