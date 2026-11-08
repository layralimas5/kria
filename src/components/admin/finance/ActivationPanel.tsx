import { useState, type FormEvent } from 'react'
import { ACTIVATION_BLOCKERS, ACTIVATION_WARNINGS, conversionDeviation, type ModelQuotes, type Preflight } from '@/domain/creditPolicy'
import { formatBRL } from '@/domain/format'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/hooks/useToast'
import { activatePricingV2, fetchPreflight, rollbackPricingV2 } from '@/lib/adminApi'
import { errorMessage } from '@/lib/api'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { Spinner } from '../../ui/Spinner'
import { GRID, Section } from '../dashboard/DashboardSections'
import { StatTile } from '../dashboard/StatTile'
import { DataTable, type Column } from './DataTable'
import { formatNumber, formatPercent, formatUsd } from './format'

type PreflightModel = Preflight['models'][number]

function PreflightReport({ preflight, legacyCost }: { readonly preflight: Preflight; readonly legacyCost: number }) {
  const { wallets } = preflight
  const columns: Column<PreflightModel>[] = [
    { key: 'name', label: 'Modelo', render: (model) => model.name },
    {
      key: 'status',
      label: 'Custo',
      render: (model) =>
        !model.active ? 'Desligado' : model.drift ? <span className="text-red-300">Preço mudou</span> : model.trusted ? 'Confiável' : <span className="text-red-300">A conferir</span>,
    },
    { key: 'cost', label: 'Por operação', align: 'right', render: (model) => formatUsd(model.provider_cost_usd) },
    { key: 'before', label: 'Créditos hoje', align: 'right', render: (model) => formatNumber(model.credits) },
    { key: 'after', label: 'Créditos v2', align: 'right', render: (model) => (model.credits_after === null ? '–' : formatNumber(model.credits_after)) },
    {
      key: 'deviation',
      label: 'Poder de compra',
      align: 'right',
      render: (model) => {
        const deviation = conversionDeviation(model.legacy_brl_per_credit, legacyCost)
        return deviation === null ? '–' : <span className={deviation < -0.05 ? 'text-red-300' : undefined}>{`${deviation > 0 ? '+' : ''}${formatPercent(deviation)}`}</span>
      },
    },
  ]
  return (
    <div className="space-y-4">
      <div className={GRID}>
        <StatTile label="Contas com saldo" value={formatNumber(wallets.accounts)} />
        <StatTile label="Saldo de plano" value={formatNumber(wallets.subscription_credits)} hint={`Vira ${formatNumber(wallets.subscription_after)}`} />
        <StatTile label="Saldo comprado" value={formatNumber(wallets.purchased_credits)} hint={`Vira ${formatNumber(wallets.purchased_after)}`} />
        <StatTile label="Boas-vindas já dadas" value={formatNumber(preflight.welcome_granted.credits)} hint={`${formatNumber(preflight.welcome_granted.accounts)} contas; convertem junto com o saldo`} />
        <StatTile label="Reservas abertas" value={formatNumber(preflight.held.reservations)} tone={preflight.held.reservations > 0 ? 'bad' : undefined} />
        <StatTile label="Gerações em andamento" value={formatNumber(preflight.open_generations)} tone={preflight.open_generations > 0 ? 'bad' : undefined} />
        <StatTile label="Fator de conversão" value={preflight.factor.toLocaleString('pt-BR')} hint="Custo médio do crédito × segurança ÷ orçamento" />
        <StatTile label="Boas-vindas depois" value={formatNumber(preflight.next_welcome_credits)} hint="Só conta nova com e-mail confirmado" />
      </div>
      <DataTable
        caption="Impacto por modelo"
        rows={preflight.models}
        columns={columns}
        rowKey={(model) => model.slug}
        rowTone={(model) => (model.active && !model.trusted ? 'bad' : undefined)}
        empty="Nenhum modelo."
      />
      <p className="text-xs text-zinc-500">
        Poder de compra: quanto um crédito de hoje passa a comprar a mais (ou a menos) nesse modelo depois da conversão pelo custo médio. Negativo = quem tem saldo perde nesse modelo.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
          <p className="text-[13px] font-semibold text-zinc-300">Assinaturas atuais</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {preflight.subscriptions.length === 0 && <li>Nenhuma.</li>}
            {preflight.subscriptions.map((row) => (
              <li key={`${row.plan_slug}:${row.status}`}>
                {row.plan_slug} ({row.status}): {formatNumber(row.count)}, créditos/mês {formatNumber(row.monthly_credits)} → {formatNumber(row.monthly_credits_after)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
          <p className="text-[13px] font-semibold text-zinc-300">Pacotes avulsos (preço não muda)</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {preflight.packs.map((pack) => (
              <li key={pack.slug}>
                {pack.name} ({formatBRL(pack.price_cents)}): {formatNumber(pack.credits)} → {formatNumber(pack.credits_after)} créditos
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ul className="space-y-1 text-sm text-zinc-400" aria-label="Margem dos planos novos">
        {preflight.plans.map((plan) => (
          <li key={plan.slug}>
            {plan.name}: {formatBRL(plan.price_cents)}, {formatNumber(plan.monthly_credits)} créditos,{' '}
            <span className={(plan.full_use_margin ?? 0) < preflight.target_margin ? 'font-semibold text-red-300' : 'text-zinc-200'}>
              {formatPercent(plan.full_use_margin)} no uso integral
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivationForm({ preflight, onDone }: { readonly preflight: Preflight; readonly onDone: () => void }) {
  const notify = useToast()
  const [reason, setReason] = useState('')
  const [accept, setAccept] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const belowTarget = preflight.warnings.includes('margin_below_target')
  const blocked = preflight.blockers.length > 0

  async function activate() {
    setBusy(true)
    try {
      const result = await activatePricingV2(reason.trim(), belowTarget && accept)
      notify(`Preços novos ligados. ${result.wallets} saldos convertidos pelo fator ${result.factor.toLocaleString('pt-BR')}.`)
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
    if (reason.trim().length < 10) return setError('Escreva o motivo da virada (pelo menos 10 caracteres).')
    if (belowTarget && !accept) return setError('Marque o aceite da margem abaixo da meta, ou ajuste os planos na calculadora.')
    setError(null)
    setConfirming(true)
  }

  return (
    <form onSubmit={review} className="space-y-4 rounded-3xl border border-hot/30 bg-surface p-5">
      <div>
        <h3 className="text-sm font-bold text-zinc-100">Ligar os preços novos</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Converte saldos, pacotes, assinaturas e planos atuais pelo fator {preflight.factor.toLocaleString('pt-BR')}, guarda uma foto de tudo para a volta, liga a trava de custo e põe
          Creator Start, Pro e Max à venda. Business segue em rascunho. Publique o front com a vitrine nova junto.
        </p>
      </div>
      {preflight.blockers.map((code) => (
        <Notice key={code} tone="error">
          {ACTIVATION_BLOCKERS[code]}
        </Notice>
      ))}
      {preflight.warnings.map((code) => (
        <Notice key={code} tone="error">
          {ACTIVATION_WARNINGS[code]}
        </Notice>
      ))}
      <TextField label="Motivo" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
      {belowTarget && (
        <label className="flex items-start gap-2.5 text-sm text-zinc-300">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={accept} onChange={(event) => setAccept(event.target.checked)} />
          Aceito ligar com margem abaixo da meta. Exige a permissão de exceção do dono e fica na auditoria com os planos afetados.
        </label>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={blocked}>
        Revisar virada
      </Button>
      <ConfirmDialog open={confirming} title="Ligar os preços novos" confirmLabel="Ligar agora" busy={busy} onConfirm={() => void activate()} onCancel={() => setConfirming(false)}>
        <p>
          {formatNumber(preflight.wallets.accounts)} saldos e as assinaturas atuais serão multiplicados por {preflight.factor.toLocaleString('pt-BR')}. Conta nova ganha{' '}
          {preflight.next_welcome_credits} créditos.
        </p>
        <p className="text-zinc-400">A volta fica disponível enquanto ninguém assinar um plano novo.</p>
      </ConfirmDialog>
    </form>
  )
}

function RollbackForm({ onDone }: { readonly onDone: () => void }) {
  const notify = useToast()
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function rollback() {
    setBusy(true)
    try {
      const result = await rollbackPricingV2(reason.trim())
      notify(`Virada desfeita. ${result.wallets} saldos voltaram para a escala anterior.`)
      onDone()
    } catch (rollbackError) {
      setError(errorMessage(rollbackError))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (reason.trim().length < 10) return setError('Escreva o motivo da volta (pelo menos 10 caracteres).')
        setError(null)
        setConfirming(true)
      }}
      className="space-y-3 rounded-3xl border border-white/[0.08] bg-surface p-5"
    >
      <h3 className="text-sm font-bold text-zinc-100">Desfazer a virada</h3>
      <p className="text-sm text-zinc-400">
        Pause as gerações antes. Divide os saldos pelo mesmo fator (arredondando a favor da pessoa) e devolve modelos, planos, pacotes e assinaturas à foto da virada. Travado se alguém
        já assinou um plano novo.
      </p>
      <TextField label="Motivo" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary">
        Revisar volta
      </Button>
      <ConfirmDialog open={confirming} title="Desfazer a virada" confirmLabel="Desfazer agora" busy={busy} onConfirm={() => void rollback()} onCancel={() => setConfirming(false)}>
        <p>Saldos, planos e preços em créditos voltam ao que eram antes da virada. A vitrine nova precisa sair do ar junto.</p>
      </ConfirmDialog>
    </form>
  )
}

/** Checagem da virada (o que muda, para quem), a virada com as travas e a volta. */
export function ActivationPanel({ quotes, onChanged }: { readonly quotes: ModelQuotes; readonly onChanged: () => void }) {
  const preflight = useQuery(fetchPreflight, 'Não deu para carregar a checagem da virada.')
  const done = () => {
    void preflight.reload()
    onChanged()
  }
  if (quotes.settings.credit_scale === 2) {
    return (
      <Section title="Volta da virada">
        <RollbackForm onDone={done} />
      </Section>
    )
  }
  return (
    <Section title="Checagem da virada" description="Tudo o que a virada vai mexer, antes de mexer. Nada aqui muda saldo ou plano.">
      {preflight.error && <Notice tone="error">{preflight.error}</Notice>}
      {!preflight.data ? (
        <div className="grid place-items-center py-10 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-5" />
        </div>
      ) : (
        <>
          <PreflightReport preflight={preflight.data} legacyCost={quotes.settings.legacy_cost_per_credit_brl} />
          <ActivationForm preflight={preflight.data} onDone={done} />
        </>
      )}
    </Section>
  )
}
