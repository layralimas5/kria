import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StoreFrame } from '@/components/store/StoreFrame'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { track } from '@/lib/analytics'
import { errorMessage, startStoreCheckout } from '@/lib/api'

const PRODUCT_SLUG = /^[a-z0-9-]{2,40}$/

/**
 * `/comprar/:product`: o botão da página de vendas aponta para cá. Abre o checkout do Asaas e manda a
 * pessoa para lá; não pede conta no Vynkio.
 */
export function BuyPage() {
  const { product = '' } = useParams()
  const valid = PRODUCT_SLUG.test(product)
  const [error, setError] = useState<string | null>(valid ? null : 'Produto não encontrado.')
  const started = useRef(false)

  const start = useCallback(async () => {
    setError(null)
    track({ name: 'begin_checkout', params: { product } })
    try {
      window.location.assign(await startStoreCheckout(product))
    } catch (checkoutError) {
      setError(errorMessage(checkoutError))
    }
  }, [product])

  useEffect(() => {
    // StrictMode monta duas vezes; o checkout só pode ser pedido uma.
    if (started.current || !valid) return
    started.current = true
    void start()
  }, [start, valid])

  return (
    <StoreFrame>
      {error ? (
        <div className="space-y-4 text-left">
          <Notice tone="error">{error}</Notice>
          {valid && (
            <Button onClick={() => void start()} className="w-full">
              Tentar de novo
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4" role="status">
          <Spinner className="size-7 text-accent-soft" />
          <p className="text-lg font-semibold text-zinc-50">Abrindo o pagamento seguro</p>
        </div>
      )}
    </StoreFrame>
  )
}
