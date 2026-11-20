import { Lock, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BuyerFields } from '@/components/checkout/BuyerFields'
import { CardFields } from '@/components/checkout/CardFields'
import { CheckoutStep } from '@/components/checkout/CheckoutStep'
import { OrderBumpCard } from '@/components/checkout/OrderBumpCard'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { PaymentMethodPicker } from '@/components/checkout/PaymentMethodPicker'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL } from '@/domain/format'
import { useStoreCheckout } from '@/hooks/useStoreCheckout'
import { useStoreOffer } from '@/hooks/useStoreOffer'
import { track } from '@/lib/analytics'
import type { StoreOffer } from '@/lib/api'

const PRODUCT_SLUG = /^[a-z0-9-]{2,40}$/

function ProductHeader({ offer }: { readonly offer: StoreOffer }) {
  const { product } = offer
  return (
    <header className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface">
      {product.coverUrl && (
        <img src={product.coverUrl} alt="" width={1200} height={480} className="aspect-[5/2] w-full object-cover" fetchPriority="high" />
      )}
      <div className="p-5 sm:p-6">
        <h1 className="text-xl font-semibold leading-snug text-zinc-50 sm:text-2xl">{product.name}</h1>
        {product.tagline && <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{product.tagline}</p>}
        <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-50">{formatBRL(product.priceCents)}</p>
      </div>
    </header>
  )
}

function CheckoutForm({ offer }: { readonly offer: StoreOffer }) {
  const navigate = useNavigate()
  const checkout = useStoreCheckout(offer)
  const { quote } = checkout

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = await checkout.submit()
    if (token) navigate(`/pedido/${token}`)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <div className="space-y-5">
        <ProductHeader offer={offer} />
        <CheckoutStep number={1} title="Seus dados">
          <BuyerFields value={checkout.buyer} onChange={checkout.setBuyer} />
        </CheckoutStep>
        <CheckoutStep number={2} title="Pagamento">
          <div className="space-y-5">
            <PaymentMethodPicker value={checkout.method} onChange={checkout.setMethod} />
            {checkout.method === 'card' ? (
              <CardFields
                value={checkout.card}
                onChange={checkout.setCard}
                options={quote.options}
                installments={checkout.installments}
                onInstallments={checkout.setInstallments}
              />
            ) : (
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-zinc-400">
                Ao finalizar, o QR Code e o código copia e cola aparecem aqui mesmo. O acesso libera assim que o Pix cair.
              </p>
            )}
          </div>
        </CheckoutStep>
        {offer.bumps.length > 0 && (
          <section aria-label="Leve junto" className="space-y-3">
            {offer.bumps.map((bump) => (
              <OrderBumpCard key={bump.slug} bump={bump} checked={checkout.bumps.has(bump.slug)} onToggle={() => checkout.toggleBump(bump.slug)} />
            ))}
          </section>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <OrderSummary offer={offer} bumps={checkout.bumps} subtotalCents={quote.subtotalCents} selected={quote.selected} />
        {checkout.error && <Notice tone="error">{checkout.error}</Notice>}
        <Button type="submit" loading={checkout.submitting} className="min-h-12 w-full text-base">
          {checkout.method === 'pix' ? 'Gerar Pix' : 'Comprar agora'}
        </Button>
        <ul className="space-y-1.5 text-xs text-zinc-500">
          <li className="flex items-center gap-2">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" /> Pagamento processado pelo Asaas. O Vynkio não guarda o seu cartão.
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" /> Acesso imediato por e-mail depois da confirmação.
          </li>
        </ul>
      </aside>
    </form>
  )
}

/**
 * `/comprar/:product`: checkout próprio da loja (docs/loja.md). O botão da página de vendas aponta para
 * cá. Sem conta no Vynkio: dados, pagamento e "leve junto" na mesma tela.
 */
export function CheckoutPage() {
  const { product = '' } = useParams()
  const valid = PRODUCT_SLUG.test(product)
  const state = useStoreOffer(valid ? product : '')
  const tracked = useRef(false)

  useEffect(() => {
    if (state.kind !== 'ready' || tracked.current) return
    tracked.current = true
    track({ name: 'begin_checkout', params: { product } })
  }, [state.kind, product])

  return (
    <main className="min-h-dvh bg-canvas px-4 pb-16 pt-6 sm:pt-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Logo />
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <Lock className="size-3.5" aria-hidden="true" /> Compra segura
          </span>
        </div>
        {!valid && <Notice tone="error">Produto não encontrado.</Notice>}
        {valid && state.kind === 'loading' && (
          <div className="grid min-h-[50vh] place-items-center" role="status">
            <Spinner className="size-7 text-accent-soft" />
            <span className="sr-only">Carregando o checkout</span>
          </div>
        )}
        {valid && state.kind === 'error' && (
          <div className="mx-auto max-w-sm space-y-4">
            <Notice tone="error">{state.message}</Notice>
            <Button onClick={state.reload} className="w-full">
              Tentar de novo
            </Button>
          </div>
        )}
        {state.kind === 'ready' && <CheckoutForm offer={state.offer} />}
      </div>
    </main>
  )
}
