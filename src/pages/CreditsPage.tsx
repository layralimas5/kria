import clsx from 'clsx'
import { Coins, QrCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL, formatCredits, formatDateTime } from '@/domain/format'
import { purchaseSchema, type CreditPack, type LedgerEntry, type Purchase } from '@/domain/types'
import { errorMessage, startCheckout } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useBalance } from '@/hooks/useBalance'
import { useLedger, usePacks } from '@/hooks/useCatalog'

const REASON_LABELS: Record<LedgerEntry['reason'], string> = {
  signup_bonus: 'Boas-vindas',
  purchase: 'Compra',
  generation: 'Geração',
  generation_refund: 'Estorno',
  adjustment: 'Ajuste',
}

function PackCard({ pack, onBuy, busy }: { readonly pack: CreditPack; readonly onBuy: () => void; readonly busy: boolean }) {
  const perCredit = pack.price_cents / pack.credits / 100
  return (
    <article
      className={clsx(
        'relative flex flex-col rounded-2xl border p-5',
        pack.highlight ? 'border-accent/50 bg-accent/[0.05]' : 'border-white/[0.08] bg-zinc-900/50',
      )}
    >
      {pack.highlight && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
          Mais escolhido
        </span>
      )}
      <h3 className="text-sm font-medium text-zinc-300">{pack.name}</h3>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-50">{pack.credits}</p>
      <p className="text-sm text-zinc-500">créditos</p>
      <p className="mt-4 text-lg font-medium text-zinc-100">{formatBRL(pack.price_cents)}</p>
      <p className="text-xs text-zinc-500">R$ {perCredit.toFixed(2).replace('.', ',')} por crédito</p>
      <Button className="mt-5" variant={pack.highlight ? 'primary' : 'secondary'} onClick={onBuy} loading={busy}>
        Comprar
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
    <div className="space-y-10">
      <PageHeader
        title="Créditos"
        description="Cada criação usa créditos. Compre um pacote quando precisar, sem mensalidade."
        action={
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <Coins className="size-5 text-accent" aria-hidden="true" />
            <div>
              <p className="text-xs text-zinc-500">Seu saldo</p>
              <p className="font-semibold tabular-nums text-zinc-50">{balance === null ? '...' : formatCredits(balance)}</p>
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

      <section aria-labelledby="packs-title" className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <QrCode className="size-4" aria-hidden="true" />
          <h2 id="packs-title">Pix ou cartão. Os créditos não expiram.</h2>
        </div>
        {packs.error && <Notice tone="error">{packs.error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-3">
          {packs.data?.map((pack) => (
            <PackCard key={pack.slug} pack={pack} busy={buying === pack.slug} onBuy={() => void buy(pack)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="ledger-title" className="space-y-3">
        <h2 id="ledger-title" className="text-sm font-medium text-zinc-300">
          Extrato
        </h2>
        {ledger.error && <Notice tone="error">{ledger.error}</Notice>}
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07]">
          {ledger.data?.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate text-zinc-200">
                  {REASON_LABELS[entry.reason]}
                  {entry.note && <span className="text-zinc-500"> · {entry.note}</span>}
                </p>
                <p className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</p>
              </div>
              <span className={clsx('shrink-0 font-medium tabular-nums', entry.delta > 0 ? 'text-accent' : 'text-zinc-400')}>
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
