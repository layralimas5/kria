// POST { token, action?: 'status' | 'download' }
// Página do pedido da loja (docs/loja.md). O token de 64 caracteres é a única chave: vem na volta do
// checkout e no e-mail. `status` diz se já pagou; `download` devolve uma URL assinada de 10 minutos
// para o arquivo e conta o download. Pedido estornado não baixa mais.

import { z } from 'npm:zod@3'
import { adminClient, errorResponse, handle, json, readJson } from '../_shared/http.ts'

const bodySchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  action: z.enum(['status', 'download']).default('status'),
})

/** Freio contra link compartilhado em grupo: quem comprou baixa algumas vezes, não centenas. */
const MAX_DOWNLOADS = 30
const SIGNED_URL_SECONDS = 600

interface OrderRow {
  readonly id: string
  readonly status: 'pending' | 'paid' | 'refunded' | 'expired'
  readonly downloads: number
  readonly price_cents: number
  readonly store_products: { readonly name: string; readonly file_path: string; readonly file_name: string; readonly sales_url: string }
}

Deno.serve(
  handle(async (request) => {
    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(404, 'order_not_found', 'Pedido não encontrado.')

    const admin = adminClient()
    const { data: order } = await admin
      .from('store_orders')
      .select('id, status, downloads, price_cents, store_products(name, file_path, file_name, sales_url)')
      .eq('access_token', parsed.data.token)
      .maybeSingle<OrderRow>()
    if (!order) return errorResponse(404, 'order_not_found', 'Pedido não encontrado.')

    const product = order.store_products
    const summary = { status: order.status, product: product.name, priceCents: order.price_cents, salesUrl: product.sales_url }
    if (parsed.data.action === 'status') return json(summary)

    if (order.status !== 'paid') return errorResponse(409, 'order_not_paid', 'O pagamento ainda não foi confirmado.')
    if (order.downloads >= MAX_DOWNLOADS) {
      return errorResponse(429, 'download_limit', 'Esse pedido chegou ao limite de downloads. Responda o e-mail de entrega que a gente libera.')
    }

    const { data: signed, error } = await admin.storage
      .from('store')
      .createSignedUrl(product.file_path, SIGNED_URL_SECONDS, { download: product.file_name })
    if (error || !signed) throw new Error(`signed url: ${error?.message}`)
    await admin
      .from('store_orders')
      .update({ downloads: order.downloads + 1, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    return json({ ...summary, url: signed.signedUrl })
  }),
)
