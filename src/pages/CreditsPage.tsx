import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { UsageLimits } from '@/components/billing/UsageLimits'
import { BalanceHero } from '@/components/credits/BalanceHero'
import { LedgerList } from '@/components/credits/LedgerList'
import { PackCard } from '@/components/credits/PackCard'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { monthSummary, packSavings, yieldByModel } from '@/domain/credits'
import { formatCredits } from '@/domain/format'
import { purchaseSchema, type CreditPack, type Purchase } from '@/domain/types'
import { errorMessage, startCheckout } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useBalance } from '@/hooks/useBalance'
import { useLedger, useModels, usePacks } from '@/hooks/useCatalog'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const PERKS = ['Pix ou cartão', 'Créditos de pacote não expiram', 'Falhou? O crédito volta']

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
  const reduceMotion = useReducedMotion()
  const [params] = useSearchParams()
  const { balance, wallet } = useBalance()
  const packs = usePacks()
  const models = useModels()
  const ledger = useLedger()
  const purchase = usePurchaseStatus(params.get('compra'))
  const [buying, setBuying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reloadLedger = ledger.reload
  const now = useMemo(() => new Date(), [])

  // Saldo mudou (geração, compra): o extrato acompanha.
  useEffect(() => {
    if (balance !== null) void reloadLedger()
  }, [balance, reloadLedger])

  const studioModels = useMemo(() => models.data ?? [], [models.data])
  const balanceYields = useMemo(() => (wallet ? yieldByModel(wallet.balance, studioModels) : []), [wallet, studioModels])
  const month = useMemo(() => (ledger.data ? monthSummary(ledger.data, now) : null), [ledger.data, now])

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
    <div className="mx-auto max-w-6xl space-y-10 pb-10 pt-2">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-end justify-between gap-5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Créditos e consumo</p>
          <h1 className="font-headline mt-2 text-4xl text-balance text-zinc-50 md:text-5xl">
            Créditos que viram{' '}
            <span className="bg-gradient-to-r from-accent-soft via-violet-300 to-galaxy bg-clip-text text-transparent">criação</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-pretty text-zinc-400 md:text-base">Veja quanto o seu saldo rende, para onde foram os créditos e compre pacotes avulsos quando precisar.</p>
        </div>
        <Link to="/assinatura" className={clsx('group inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-surface-2 px-4 text-sm font-semibold text-zinc-100 hover:bg-surface-3', FOCUS)}>
          Créditos todo mês: ver planos
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </motion.header>

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
      {ledger.error && <Notice tone="error">{ledger.error}</Notice>}

      <BalanceHero wallet={wallet} yields={balanceYields} month={month} now={now} />

      <UsageLimits />

      <section aria-labelledby="packs-title" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="packs-title" className="font-headline text-lg text-zinc-100">
              Pacotes avulsos
            </h2>
            <p className="text-sm text-zinc-500">Pagamento único, sem mensalidade. Somam ao saldo na hora.</p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-zinc-400">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-1.5">
                <Check className="size-4 text-accent-soft" aria-hidden="true" /> {perk}
              </li>
            ))}
          </ul>
        </div>
        {packs.error && <Notice tone="error">{packs.error}</Notice>}
        <div className="grid gap-4 md:grid-cols-3">
          {packs.data
            ? packs.data.map((pack) => (
                <PackCard
                  key={pack.slug}
                  pack={pack}
                  yields={yieldByModel(pack.credits, studioModels)}
                  savings={packSavings(pack, packs.data ?? [])}
                  busy={buying === pack.slug}
                  onBuy={() => void buy(pack)}
                />
              ))
            : !packs.error && Array.from({ length: 3 }, (_, index) => <div key={index} className="h-96 animate-pulse rounded-3xl bg-surface" aria-hidden="true" />)}
        </div>
        <p className="text-xs text-zinc-500">Quantidades se todos os créditos forem usados num modelo só, na configuração padrão.</p>
      </section>

      <LedgerList entries={ledger.data ?? (ledger.error ? [] : null)} now={now} />
    </div>
  )
}
