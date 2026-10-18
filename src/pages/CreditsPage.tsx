import clsx from 'clsx'
import { Check, Coins } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL, formatCredits, formatDateTime } from '@/domain/format'
import { purchaseSchema, type CreditPack, type LedgerEntry, type Model, type Purchase } from '@/domain/types'
import { errorMessage, startCheckout } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useBalance } from '@/hooks/useBalance'
import { useLedger, useModels, usePacks } from '@/hooks/useCatalog'

const REASON_LABELS: Record<LedgerEntry['reason'], string> = {
  signup_bonus: 'Boas-vindas',
  purchase: 'Compra',
  generation: 'Geração',
  generation_refund: 'Estorno',
  adjustment: 'Ajuste',
  subscription_grant: 'Plano',
  subscription_expire: 'Fim do ciclo',
}

const PERKS = ['Pix ou cartão', 'Créditos de pacote não expiram', 'Falhou? O crédito volta']

/** Quanto o pacote rende em cada modelo, para a pessoa entender o que está comprando. */
function yieldLines(pack: CreditPack, models: readonly Model[]): string[] {
  return models
    .filter((model) => (model.slug === 'foto' || model.kind === 'video') && pack.credits >= model.credits)
    .map((model) => `${Math.floor(pack.credits / model.credits)} × ${model.name}`)
}

interface PackCardProps {
  readonly pack: CreditPack
  readonly models: readonly Model[]
  readonly busy: boolean
  readonly onBuy: () => void
}

function PackCard({ pack, models, busy, onBuy }: PackCardProps) {
  const perCredit = pack.price_cents / pack.credits / 100
  return (
    <article
      className={clsx(
        'relative flex flex-col rounded-3xl p-6 ring-1',
        pack.highlight ? 'bg-gradient-to-b from-accent/[0.12] to-surface ring-accent/60' : 'bg-surface ring-white/[0.06]',
      )}
    >
      {pack.highlight && (
        <span className="absolute -top-3 left-6 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold uppercase italic tracking-wide text-accent-ink">
          Mais escolhido
        </span>
      )}
      <h3 className="font-headline text-xl text-zinc-100">{pack.name}</h3>
      <p className="mt-5 flex items-baseline gap-2">
        <span className="font-headline text-6xl tabular-nums text-zinc-50">{pack.credits}</span>
        <span className="text-sm font-semibold text-zinc-400">créditos</span>
      </p>
      <p className="mt-4 text-2xl font-bold text-zinc-50">{formatBRL(pack.price_cents)}</p>
      <p className="text-xs text-zinc-500">R$ {perCredit.toFixed(2).replace('.', ',')} por crédito</p>

      <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-5 text-sm text-zinc-300">
        {yieldLines(pack, models).map((line) => (
          <li key={line} className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
            Até {line}
          </li>
        ))}
      </ul>

      <Button className="mt-6 min-h-11" variant={pack.highlight ? 'primary' : 'secondary'} onClick={onBuy} loading={busy}>
        Comprar {pack.name}
      </Button>
    </article>
  )
}

/** Depois do checkout: acompanha a compra até o webhook creditar. */
function usePurchaseStatus(purchaseId: string | null): Purchase | null {
  const [purchase, setPurchase] = useState<Purchase | null>(null)

  useEffect(() => {
    if (!purchaseId) return
    let attempts = 0
    const check = async () => {
      attempts += 1
      const { data } = await supabase.from('purchases').select('id, status, credits').eq('id', purchaseId).maybeSingle()
      const parsed = purchaseSchema.safeParse(data)
      if (parsed.success) setPurchase(parsed.data)
      return parsed.success && parsed.data.status !== 'pending'
    }
    const timer = window.setInterval(async () => {
      if ((await check()) || attempts > 40) window.clearInterval(timer)
    }, 3000)
    void check()
    return () => window.clearInterval(timer)
  }, [purchaseId])

  return purchase
}

export function CreditsPage() {
  const [params] = useSearchParams()
  const { balance } = useBalance()
  const packs = usePacks()
  const models = useModels()
  const ledger = useLedger()
  const purchase = usePurchaseStatus(params.get('compra'))
  const [buying, setBuying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reloadLedger = ledger.reload

  useEffect(() => {
    if (balance !== null) void reloadLedger()
  }, [balance, reloadLedger])

  async function buy(pack: CreditPack) {
    setBuying(pack.slug)
    setError(null)
    try {
      window.location.assign(await startCheckout(pack.slug))
    } catch (buyError) {
      setError(errorMessage(buyError))
      setBuying(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 pt-4">
      <PageHeader
        title="Créditos"
        description="Pacotes avulsos, sem mensalidade. Para receber créditos todo mês, veja os planos em Assinatura."
        action={
          <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-white/[0.06]">
            <Coins className="size-5 text-accent" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Seu saldo</p>
              <p className="text-lg font-bold tabular-nums text-zinc-50">{balance === null ? '...' : formatCredits(balance)}</p>
            </div>
          </div>
        }
      />

      {purchase?.status === 'paid' && <Notice tone="success">Pagamento confirmado. {formatCredits(purchase.credits)} na sua conta.</Notice>}
      {purchase?.status === 'pending' && (
        <Notice>
          <span className="flex items-center gap-2">
            <Spinner className="size-4" /> Esperando a confirmação do pagamento. No Pix costuma levar segundos.
          </span>
        </Notice>
      )}
      {purchase?.status === 'expired' && <Notice tone="error">O pagamento expirou. Você pode comprar de novo abaixo.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <section aria-label="Pacotes de créditos" className="space-y-5">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-1.5">
              <Check className="size-4 text-accent" aria-hidden="true" /> {perk}
            </li>
          ))}
        </ul>
        {packs.error && <Notice tone="error">{packs.error}</Notice>}
        <div className="grid gap-4 pt-2 md:grid-cols-3">
          {packs.data?.map((pack) => (
            <PackCard key={pack.slug} pack={pack} models={models.data ?? []} busy={buying === pack.slug} onBuy={() => void buy(pack)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="ledger-title" className="space-y-3">
        <h2 id="ledger-title" className="font-headline text-lg text-zinc-100">
          Extrato
        </h2>
        {ledger.error && <Notice tone="error">{ledger.error}</Notice>}
        <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06]">
          {ledger.data?.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-200">
                  {REASON_LABELS[entry.reason]}
                  {entry.note && <span className="font-normal text-zinc-500"> · {entry.note}</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(entry.created_at)}
                  {entry.balance_after !== null && ` · saldo ${entry.balance_after.toLocaleString('pt-BR')}`}
                </p>
              </div>
              <span className={clsx('shrink-0 font-bold tabular-nums', entry.delta > 0 ? 'text-accent' : 'text-zinc-400')}>
                {entry.delta > 0 ? '+' : ''}
                {entry.delta}
              </span>
            </li>
          ))}
          {ledger.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">Sem movimentos.</li>}
        </ul>
      </section>
    </div>
  )
}
