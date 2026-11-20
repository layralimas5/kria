// POST { product }
// Loja de infoprodutos (docs/loja.md): cria o pedido pendente e o checkout avulso do Asaas (Pix ou
// cartão) e devolve o link. Não pede conta no Vynkio: nome, e-mail e CPF ficam no checkout do Asaas.
// O pedido só vira pago pelo asaas-webhook. Na volta do checkout, a pessoa cai na página do pedido.

import { z } from 'npm:zod@3'
import { AsaasError, createStoreCheckout } from '../_shared/asaas.ts'
import { adminClient, errorResponse, handle, json, readJson, requireEnv } from '../_shared/http.ts'

const bodySchema = z.object({ product: z.string().regex(/^[a-z0-9-]{2,40}$/) })

/** Sem login, o freio é global: checkout aberto e não pago expira sozinho em 60 minutos. */
const MAX_PENDING_PER_10_MIN = 40

interface ProductRow {
  readonly slug: string
  readonly name: string
  readonly price_cents: number
  readonly sales_url: string
}

Deno.serve(
  handle(async (request) => {
    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')

    const admin = adminClient()
    const { data: product } = await admin
      .from('store_products')
      .select('slug, name, price_cents, sales_url')
      .eq('slug', parsed.data.product)
      .eq('active', true)
      .maybeSingle<ProductRow>()
    if (!product) return errorResponse(404, 'product_not_found', 'Produto não encontrado.')

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('store_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('created_at', tenMinutesAgo)
    if ((count ?? 0) >= MAX_PENDING_PER_10_MIN) {
      return errorResponse(429, 'too_many_checkouts', 'Muita gente comprando agora. Tente de novo em alguns minutos.')
    }

    const { data: order, error } = await admin
      .from('store_orders')
      .insert({ product_slug: product.slug, price_cents: product.price_cents })
      .select('id, access_token')
      .single<{ id: string; access_token: string }>()
    if (error || !order) throw new Error(`insert store order: ${error?.message}`)

    try {
      const checkout = await createStoreCheckout({
        orderId: order.id,
        productName: product.name,
        priceCents: product.price_cents,
        successUrl: `${requireEnv('APP_URL')}/pedido/${order.access_token}`,
        cancelUrl: product.sales_url,
      })
      await admin
        .from('store_orders')
        .update({ provider_checkout_id: checkout.id, checkout_url: checkout.link, updated_at: new Date().toISOString() })
        .eq('id', order.id)
      return json({ url: checkout.link }, 201)
    } catch (checkoutError) {
      console.error('store checkout failed', checkoutError instanceof AsaasError ? checkoutError.body : checkoutError)
      await admin.from('store_orders').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', order.id)
      return errorResponse(502, 'payment_unavailable', 'O pagamento não abriu agora. Tente de novo em instantes.')
    }
  }),
)
