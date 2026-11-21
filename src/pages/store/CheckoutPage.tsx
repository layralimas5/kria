import { BadgeCheck, ShieldCheck, Zap } from 'lucide-react'
import { useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BuyerFields } from '@/components/checkout/BuyerFields'
import { CardFields } from '@/components/checkout/CardFields'
import { BuyButton, PixInfo, TrustBadges, type TrustItem } from '@/components/checkout/CheckoutActions'
import { CheckoutAlert } from '@/components/checkout/CheckoutAlert'
import { CheckoutStep } from '@/components/checkout/CheckoutStep'
import { OrderBumpCard } from '@/components/checkout/OrderBumpCard'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { PaymentMethodPicker } from '@/components/checkout/PaymentMethodPicker'
import { TestimonialsBlock } from '@/components/checkout/TestimonialsBlock'
import { StoreFooter } from '@/components/store/StoreFooter'
import { StoreHeader } from '@/components/store/StoreHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatBRL } from '@/domain/format'
import { longestInstallment, quoteCheckout } from '@/domain/storeQuote'
import { useStoreCheckout } from '@/hooks/useStoreCheckout'
import { useStoreOffer } from '@/hooks/useStoreOffer'
import { track } from '@/lib/analytics'
import type { StoreOffer } from '@/lib/api'

const PRODUCT_SLUG = /^[a-z0-9-]{2,40}$/

const TRUST: readonly TrustItem[] = [
  { Icon: ShieldCheck, title: 'Compra segura', text: 'Dados protegidos de ponta a ponta' },
  { Icon: Zap, title: 'Acesso imediato', text: 'Link no e-mail logo após a confirmação' },
  { Icon: BadgeCheck, title: '7 dias de garantia', text: 'Direito de arrependimento' },
]

const PIX_BENEFITS = ['Liberação imediata depois do pagamento', 'QR Code e código copia e cola na próxima tela', 'Sem juros e sem taxa'] as const

function ProductHeader({ offer }: { readonly offer: StoreOffer }) {
  const { product } = offer
  const longest = longestInstallment(quoteCheckout(offer, new Set(), offer.maxInstallments).options)
  return (
    <header className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {product.coverUrl && (
        <img src={product.coverUrl} alt="" width={1200} height={480} className="aspect-[5/2] w-full object-cover" fetchPriority="high" />
      )}
      <div className="p-5 sm:p-6">
        <h1 className="text-xl font-bold leading-snug text-zinc-900 sm:text-2xl">{product.name}</h1>
        {product.tagline && <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{product.tagline}</p>}
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <span className="text-3xl font-extrabold tabular-nums text-zinc-900">{formatBRL(product.priceCents)}</span>
          {longest && (
            <span className="text-sm text-zinc-500">
              ou {longest.count}x de {formatBRL(longest.installmentCents)} no cartão
            </span>
          )}
        </p>
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
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <ProductHeader offer={offer} />
      <CheckoutStep number={1} title="Seus dados">
        <BuyerFields
          value={checkout.buyer}
          onChange={checkout.setBuyer}
          emailConfirm={checkout.emailConfirm}
          onEmailConfirm={checkout.setEmailConfirm}
          showErrors={checkout.attempted}
        />
      </CheckoutStep>
      <CheckoutStep number={2} title="Pagamento">
        <div className="space-y-5">
          <PaymentMethodPicker value={checkout.method} onChange={checkout.setMethod} />
          {checkout.method === 'card' ? (
            <CardFields
              value={checkout.card}
              onChange={checkout.setCard}
              installments={{ options: quote.options, value: checkout.installments, onChange: checkout.setInstallments }}
            />
          ) : (
            <PixInfo benefits={PIX_BENEFITS} />
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
      <OrderSummary offer={offer} bumps={checkout.bumps} subtotalCents={quote.subtotalCents} selected={quote.selected} />
      {checkout.error && <CheckoutAlert>{checkout.error}</CheckoutAlert>}
      <BuyButton loading={checkout.submitting}>{checkout.method === 'pix' ? 'Gerar Pix' : 'Comprar agora'}</BuyButton>
      <TrustBadges items={TRUST} />
      <TestimonialsBlock scope={{ kind: 'store', product: offer.product.slug }} />
    </form>
  )
}

/**
 * `/comprar/:product`: checkout próprio da loja (docs/loja.md), no tema claro das plataformas de infoproduto.
 * O botão da página de vendas aponta para cá. Sem conta no Vynkio: dados, pagamento e "leve junto" na mesma tela.
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
    <div className="min-h-dvh bg-zinc-100">
      <StoreHeader />
      <main className="mx-auto max-w-[640px] px-4 py-6 sm:py-8">
        {!valid && <CheckoutAlert>Produto não encontrado.</CheckoutAlert>}
        {valid && state.kind === 'loading' && (
          <div className="grid min-h-[50vh] place-items-center" role="status">
            <Spinner className="size-7 text-violet-600" />
            <span className="sr-only">Carregando o checkout</span>
          </div>
        )}
        {valid && state.kind === 'error' && (
          <div className="space-y-4">
            <CheckoutAlert>{state.message}</CheckoutAlert>
            <button
              type="button"
              onClick={state.reload}
              className="min-h-11 w-full rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-600/30"
            >
              Tentar de novo
            </button>
          </div>
        )}
        {state.kind === 'ready' && <CheckoutForm offer={state.offer} />}
      </main>
      <StoreFooter />
    </div>
  )
}
