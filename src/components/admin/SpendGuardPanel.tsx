import { useState, type FormEvent } from 'react'
import { spendAlerts, type SpendGuard } from '@/domain/spendGuard'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { fetchSpendGuard, updateSpendGuard } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TextField } from '../ui/Field'
import { Notice } from '../ui/Notice'
import { UsageMeter } from '../ui/UsageMeter'

const usd = (value: number) => `US$ ${value.toFixed(2)}`
const parseCap = (value: string): number | null => (value.trim() === '' ? null : Number.parseFloat(value.replace(',', '.')))
const capText = (value: number | null) => (value === null ? 'sem teto' : usd(value))

function GuardForm({ guard, onSaved }: { readonly guard: SpendGuard; readonly onSaved: () => void }) {
  const notify = useToast()
  const [daily, setDaily] = useState(guard.daily_cost_cap_usd === null ? '' : String(guard.daily_cost_cap_usd))
  const [monthly, setMonthly] = useState(guard.monthly_cost_cap_usd === null ? '' : String(guard.monthly_cost_cap_usd))
  const [alert, setAlert] = useState(String(Math.round(guard.cost_alert_ratio * 100)))
  const [paused, setPaused] = useState(guard.generation_paused)
  const [reason, setReason] = useState(guard.paused_reason ?? '')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = {
    dailyCapUsd: parseCap(daily),
    monthlyCapUsd: parseCap(monthly),
    alertRatio: Number.parseFloat(alert.replace(',', '.')) / 100,
    paused,
    reason: reason.trim() === '' ? null : reason.trim(),
  }

  function review(event: FormEvent) {
    event.preventDefault()
    const caps = [update.dailyCapUsd, update.monthlyCapUsd]
    if (caps.some((cap) => cap !== null && (!Number.isFinite(cap) || cap <= 0))) return setError('Teto precisa ser um valor positivo ou ficar vazio.')
    if (!(update.alertRatio >= 0.1 && update.alertRatio <= 1)) return setError('O alerta vai de 10% a 100%.')
    if (paused && (update.reason?.length ?? 0) < 5) return setError('Para pausar, escreva o motivo (pelo menos 5 caracteres).')
    setError(null)
    setConfirming(true)
  }

  async function save() {
    setBusy(true)
    try {
      await updateSpendGuard(update)
      notify(paused ? 'Gerações pausadas para todas as contas.' : 'Guarda de gasto salva. Vale para a próxima geração.')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form onSubmit={review} className="space-y-4 border-t border-white/[0.06] pt-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Teto por dia (US$)" inputMode="decimal" value={daily} onChange={(event) => setDaily(event.target.value)} hint="Vazio = sem teto." />
        <TextField label="Teto por mês (US$)" inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} hint="Vazio = sem teto." />
        <TextField label="Alerta a partir de (%)" inputMode="numeric" value={alert} onChange={(event) => setAlert(event.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        Pausar todas as gerações agora
      </label>
      {paused && <TextField label="Motivo da pausa" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary">
        Revisar guarda
      </Button>
      <ConfirmDialog open={confirming} title="Salvar guarda de gasto" confirmLabel={paused ? 'Pausar gerações' : 'Salvar'} busy={busy} onConfirm={() => void save()} onCancel={() => setConfirming(false)}>
        <p>
          Teto do dia {capText(update.dailyCapUsd)}, do mês {capText(update.monthlyCapUsd)}, alerta em {Math.round(update.alertRatio * 100)}%.
        </p>
        <p className="text-zinc-400">
          {paused
            ? 'Ninguém gera enquanto a pausa estiver ligada. O que já está em andamento termina normalmente.'
            : 'Quando o custo estimado bater o teto, novas gerações são recusadas sem cobrar crédito.'}
        </p>
      </ConfirmDialog>
    </form>
  )
}

/** Custo da plataforma contra os tetos, com pausa de emergência (0016). */
export function SpendGuardPanel() {
  const { can } = useAdminAccess()
  const guard = useQuery(fetchSpendGuard, 'Não deu para carregar a guarda de gasto.')
  if (guard.error) return <Notice tone="error">{guard.error}</Notice>
  if (!guard.data) return null
  const { data } = guard
  const alerts = spendAlerts(data)

  return (
    <section aria-labelledby="guard-title" className="space-y-5 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <div>
        <h3 id="guard-title" className="text-sm font-bold text-zinc-200">
          Guarda de gasto
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Custo estimado da plataforma no dia e no mês (Brasília). Modelo sem custo cadastrado conta como se todo o crédito fosse custo. Falha que o fornecedor
          cobra entra na conta.
        </p>
      </div>
      {alerts.map((alert) => (
        <Notice key={alert.text} tone={alert.severe ? 'error' : 'info'}>
          {alert.text}
        </Notice>
      ))}
      <div className="grid gap-5 sm:grid-cols-2">
        <UsageMeter label="Hoje" used={data.spent_today_usd} limit={data.daily_cost_cap_usd} alertRatio={data.cost_alert_ratio} format={usd} />
        <UsageMeter
          label="Este mês"
          used={data.spent_month_usd}
          limit={data.monthly_cost_cap_usd}
          alertRatio={data.cost_alert_ratio}
          format={usd}
          footnote={data.failed_billed_month_usd > 0 ? `${usd(data.failed_billed_month_usd)} em falhas cobradas pelo fornecedor.` : undefined}
        />
      </div>
      {data.top_today && data.top_today.length > 0 && (
        <div>
          <h4 className="mb-2 text-[13px] font-semibold text-zinc-300">Quem mais gastou hoje</h4>
          <ul className="divide-y divide-white/[0.05] text-sm">
            {data.top_today.map((row) => (
              <li key={row.user_id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-zinc-300">{row.email ?? row.user_id}</span>
                <span className="shrink-0 tabular-nums text-zinc-400">
                  {row.credits.toLocaleString('pt-BR')} créditos · {usd(row.spend_usd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {can('pricing.manage') && <GuardForm key={JSON.stringify(data)} guard={data} onSaved={() => void guard.reload()} />}
    </section>
  )
}
