import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { providerLabel, UNIT_LABELS, unitPriceUsd, type CostModel } from '@/domain/aiCosts'
import type { PricingSettings } from '@/domain/pricing'
import { formatDateTime } from '@/domain/format'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { fetchModelPriceHistory, fetchModelQuotes, setModelTargetMargin, type AdminModel } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { Drawer } from '../../ui/Drawer'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { formatBrlValue, formatNumber, formatPercent, formatUsd } from '../finance/format'
import { ModelTariffEditor } from '../finance/TariffForm'
import { ModelRow } from './ModelForms'

function TargetMarginForm({ model, minMargin, onSaved }: { readonly model: CostModel; readonly minMargin: number; readonly onSaved: () => void }) {
  const notify = useToast()
  const [value, setValue] = useState(model.target_margin_rate === null ? '' : String(Math.round(model.target_margin_rate * 100)))
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parsed = value.trim() === '' ? null : Number.parseFloat(value.replace(',', '.')) / 100

  function review(event: FormEvent) {
    event.preventDefault()
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 0.95)) return setError('Use de 0 a 95%, ou deixe vazio para seguir a meta geral.')
    setError(null)
    setConfirming(true)
  }

  async function save() {
    setBusy(true)
    try {
      await setModelTargetMargin(model.slug, parsed, reason)
      notify('Meta de margem salva.')
      setReason('')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form onSubmit={review} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <TextField label="Margem desejada (%)" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder={String(Math.round(minMargin * 100))} />
        <TextField label="Motivo (vai para a auditoria)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" disabled={reason.trim().length < 5}>
        Revisar meta
      </Button>
      <ConfirmDialog open={confirming} title={`Meta de margem de ${model.name}`} confirmLabel="Salvar meta" busy={busy} onConfirm={() => void save()} onCancel={() => setConfirming(false)}>
        <p>{parsed === null ? `Volta a seguir a meta geral de ${formatPercent(minMargin)}.` : `Alerta quando a margem por geração ficar abaixo de ${formatPercent(parsed)}.`}</p>
      </ConfirmDialog>
    </form>
  )
}

function PriceHistory({ slug }: { readonly slug: string }) {
  const load = useCallback(() => fetchModelPriceHistory(slug), [slug])
  const history = useQuery(load, 'Não deu para carregar o histórico de preço.')
  if (history.error) return <Notice tone="error">{history.error}</Notice>
  if (!history.data) return <p className="text-sm text-zinc-500">Carregando…</p>
  return (
    <ol className="space-y-2">
      {history.data.map((entry) => (
        <li key={entry.id} className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
          <p className="font-semibold text-zinc-200">
            {formatDateTime(entry.effective_from)} {entry.effective_to ? `até ${formatDateTime(entry.effective_to)}` : '· em vigor'}
          </p>
          <p className="mt-0.5 text-zinc-400">
            {formatNumber(entry.credits)} créditos · {formatUsd(entry.provider_cost_usd)} por geração
            {entry.target_margin_rate !== null && ` · meta ${formatPercent(entry.target_margin_rate)}`} · {entry.active ? 'ativo' : 'inativo'}
          </p>
          {entry.changed_by_email && <p className="text-xs text-zinc-500">por {entry.changed_by_email}</p>}
        </li>
      ))}
    </ol>
  )
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h3 className="text-sm font-bold text-zinc-200">{title}</h3>
      {children}
    </section>
  )
}

interface ModelDrawerProps {
  readonly model: CostModel | null
  readonly adminModel: AdminModel | null
  readonly plans: readonly string[]
  readonly settings: PricingSettings | null
  readonly minMargin: number
  readonly onClose: () => void
  readonly onChanged: () => void
}

/** Detalhe de um modelo: números, meta, preço em créditos, tarifa oficial e vigências. */
export function ModelDrawer({ model, adminModel, plans, settings, minMargin, onClose, onChanged }: ModelDrawerProps) {
  const { can } = useAdminAccess()
  const canEdit = can('models.manage')
  const quotes = useQuery(fetchModelQuotes, 'Não deu para carregar as tarifas.')
  const quote = quotes.data?.models.find((item) => item.slug === model?.slug)

  return (
    <Drawer open={model !== null} title={model?.name ?? ''} description={model ? `${providerLabel(model.provider)} · ${model.endpoint}` : undefined} onClose={onClose} size="lg">
      {model && (
        <div className="space-y-8">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Tarifa', `${unitPriceUsd(model).label} ${UNIT_LABELS[model.unit]}`],
              ['Créditos cobrados', formatNumber(model.credits)],
              ['Margem por geração', formatPercent(model.unit_margin)],
              ['Custo no período', formatBrlValue(model.cost_period_brl)],
              ['Usos no período', formatNumber(model.uses_period)],
              ['Usos no total', formatNumber(model.uses_total)],
              ['Custo acumulado', formatBrlValue(model.cost_total_brl)],
              ['Tarifa conferida', model.cost_checked_at ? formatDateTime(model.cost_checked_at) : 'não conferida'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="mt-0.5 font-semibold text-zinc-100">{value}</dd>
              </div>
            ))}
          </dl>
          {model.cost_source && <p className="break-words text-xs text-zinc-500">Fonte da tarifa: {model.cost_source}</p>}

          {canEdit && (
            <Section title="Meta de margem">
              <TargetMarginForm key={String(model.target_margin_rate)} model={model} minMargin={minMargin} onSaved={onChanged} />
            </Section>
          )}

          {canEdit && quote && quotes.data && (
            <Section title="Tarifa oficial do fornecedor">
              <ModelTariffEditor key={JSON.stringify(quote.pricing)} model={quote} quotes={quotes.data} onSaved={onChanged} />
            </Section>
          )}

          {adminModel && settings && (
            <Section title="Preço em créditos, planos e situação">
              <ModelRow
                key={`${adminModel.slug}:${adminModel.credits}:${adminModel.provider_cost_usd}:${adminModel.active}`}
                model={adminModel}
                plans={plans}
                settings={settings}
                canEdit={canEdit}
                onSaved={onChanged}
              />
            </Section>
          )}

          <Section title="Histórico de preços (vigências)">
            <p className="text-xs text-zinc-500">Cada geração guarda o custo e os créditos da hora em que nasceu: mudar o preço não reescreve o passado.</p>
            <PriceHistory key={`${model.slug}:${model.credits}:${model.target_margin_rate}:${model.provider_cost_usd}`} slug={model.slug} />
          </Section>
        </div>
      )}
    </Drawer>
  )
}
