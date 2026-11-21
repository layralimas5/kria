import { CheckCircle2, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PixPanel } from '@/components/checkout/PixPanel'
import { StoreFrame } from '@/components/store/StoreFrame'
import { CheckoutAlert } from '@/components/checkout/CheckoutAlert'
import { Spinner } from '@/components/ui/Spinner'
import { useStoreOrder } from '@/hooks/useStoreOrder'
import { track } from '@/lib/analytics'
import { errorMessage, storeDownloadUrl, type StoreOrder } from '@/lib/api'

const TOKEN = /^[0-9a-f]{64}$/

/** Conversão conta uma vez por pedido, mesmo recarregando a página. */
function trackPurchaseOnce(token: string, order: StoreOrder) {
  const key = `kria-store-purchase:${token.slice(0, 16)}`
  try {
    if (window.localStorage.getItem(key)) return
    window.localStorage.setItem(key, '1')
  } catch {
    // Sem armazenamento (aba anônima): conta mesmo assim, no máximo repete numa recarga.
  }
  track({
    name: 'purchase',
    params: { product: order.product, value: order.priceCents / 100, currency: 'BRL', transaction_id: token.slice(0, 16) },
  })
}

function DownloadButton({ token, item }: { readonly token: string; readonly item: StoreOrder['items'][number] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      window.location.assign(await storeDownloadUrl(token, item.slug))
    } catch (downloadError) {
      setError(errorMessage(downloadError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left">
      <div className="flex items-center gap-3">
        {item.coverUrl && <img src={item.coverUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-lg object-cover" />}
        <p className="min-w-0 flex-1 text-sm font-semibold text-zinc-900">{item.name}</p>
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy}
          aria-busy={busy || undefined}
          aria-label={`Baixar ${item.name}`}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-green-700 px-4 text-sm font-bold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-600/40 disabled:opacity-80"
        >
          {busy ? <Spinner className="size-4" /> : <Download className="size-4" aria-hidden="true" />} Baixar
        </button>
      </div>
      {error && <CheckoutAlert>{error}</CheckoutAlert>}
    </li>
  )
}

function PaidOrder({ token, order }: { readonly token: string; readonly order: StoreOrder }) {
  useEffect(() => trackPurchaseOnce(token, order), [token, order])
  return (
    <>
      <CheckCircle2 className="mx-auto size-10 text-green-600" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-zinc-900">Pagamento confirmado</h1>
      <p className="text-sm text-zinc-600">Seu acesso está liberado. O mesmo link vai para o e-mail que você usou na compra.</p>
      <ul className="space-y-2">
        {order.items.map((item) => (
          <DownloadButton key={item.slug} token={token} item={item} />
        ))}
      </ul>
      <p className="text-xs text-zinc-500">Guarde esta página: o link continua valendo para baixar de novo.</p>
    </>
  )
}

function Waiting({ order, gaveUp }: { readonly order: StoreOrder; readonly gaveUp: boolean }) {
  if (order.pix && !gaveUp) return <PixPanel pix={order.pix} totalCents={order.priceCents} />
  return (
    <div className="flex flex-col items-center gap-4" role="status">
      {!gaveUp && <Spinner className="size-7 text-violet-600" />}
      <h1 className="text-lg font-semibold text-zinc-900">{gaveUp ? 'Ainda sem confirmação' : 'Confirmando o pagamento'}</h1>
      <p className="text-sm text-zinc-600">
        {gaveUp
          ? 'Se você já pagou, o link chega no seu e-mail assim que a confirmação cair. Pode recarregar esta página depois.'
          : 'No cartão costuma levar alguns segundos. Não precisa fechar esta página.'}
      </p>
    </div>
  )
}

function OrderStatus({ token, order, gaveUp }: { readonly token: string; readonly order: StoreOrder; readonly gaveUp: boolean }) {
  switch (order.status) {
    case 'paid':
      return <PaidOrder token={token} order={order} />
    case 'pending':
      return <Waiting order={order} gaveUp={gaveUp} />
    case 'expired':
    case 'failed':
      return (
        <>
          <h1 className="text-lg font-semibold text-zinc-900">O pagamento não foi concluído</h1>
          <p className="text-sm text-zinc-600">
            {order.method === 'card'
              ? 'O cartão não foi aprovado e nada foi cobrado. Tente outro cartão ou pague com Pix.'
              : 'Nada foi cobrado. Se quiser, comece de novo.'}
          </p>
          <a href={order.salesUrl} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700">
            Voltar para a página
          </a>
        </>
      )
    case 'refunded':
      return (
        <>
          <h1 className="text-lg font-semibold text-zinc-900">Pedido estornado</h1>
          <p className="text-sm text-zinc-600">O valor do {order.product} foi devolvido e o download foi encerrado.</p>
        </>
      )
  }
}

/** `/pedido/:token`: depois do checkout e no link do e-mail. Mostra o Pix, o status e libera o download. */
export function OrderPage() {
  const { token = '' } = useParams()
  const valid = TOKEN.test(token)
  const state = useStoreOrder(valid ? token : '')

  if (!valid) {
    return (
      <StoreFrame>
        <CheckoutAlert>Pedido não encontrado. Confira o link do e-mail.</CheckoutAlert>
      </StoreFrame>
    )
  }

  return (
    <StoreFrame>
      {state.kind === 'loading' && (
        <div className="flex justify-center" role="status">
          <Spinner className="size-7 text-violet-600" />
          <span className="sr-only">Carregando o pedido</span>
        </div>
      )}
      {state.kind === 'error' && <CheckoutAlert>{state.message}</CheckoutAlert>}
      {state.kind === 'ready' && <OrderStatus token={token} order={state.order} gaveUp={state.gaveUp} />}
    </StoreFrame>
  )
}
