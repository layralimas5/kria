// POST { token, action?: 'status' | 'download', item? }
// Página do pedido da loja (docs/loja.md). O token de 64 caracteres é a única chave: vem na volta do
// checkout e no e-mail. `status` diz se já pagou (e devolve o Pix enquanto espera); `download` devolve
// uma URL assinada de 10 minutos para o arquivo de um dos produtos do pedido e conta o download.
// Pedido estornado não baixa mais.

import { z } from 'npm:zod@3'
import { adminClient, errorResponse, handle, json, readJson } from '../_shared/http.ts'

const bodySchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  action: z.enum(['status', 'download']).default('status'),
  item: z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),
})

/** Freio contra link compartilhado em grupo: quem comprou baixa algumas vezes, não centenas. */
const MAX_DOWNLOADS = 30
const SIGNED_URL_SECONDS = 600

interface ItemRow {
  readonly product_slug: string
  readonly price_cents: number
  readonly is_bump: boolean
  readonly downloads: number
  readonly store_products: { readonly name: string; readonly cover_url: string | null; readonly file_path: string; readonly file_name: string }
}

interface OrderRow {
  readonly id: string
  readonly status: 'pending' | 'paid' | 'refunded' | 'expired' | 'failed'
  readonly price_cents: number
  readonly total_cents: number | null
  readonly installments: number
  readonly payment_method: 'pix' | 'card' | null
  readonly pix_payload: string | null
  readonly pix_qr_base64: string | null
  readonly pix_expires_at: string | null
  readonly store_products: { readonly name: string; readonly sales_url: string }
  readonly store_order_items: readonly ItemRow[]
}

Deno.serve(
  handle(async (request) => {
    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(404, 'order_not_found', 'Pedido não encontrado.')

    const admin = adminClient()
    const { data: order } = await admin
      .from('store_orders')
      .select(
        'id, status, price_cents, total_cents, installments, payment_method, pix_payload, pix_qr_base64, pix_expires_at, ' +
          'store_products!store_orders_product_slug_fkey(name, sales_url), ' +
          'store_order_items(product_slug, price_cents, is_bump, downloads, store_products(name, cover_url, file_path, file_name))',
      )
      .eq('access_token', parsed.data.token)
      .maybeSingle<OrderRow>()
    if (!order) return errorResponse(404, 'order_not_found', 'Pedido não encontrado.')

    const items = [...order.store_order_items].sort((a, b) => Number(a.is_bump) - Number(b.is_bump))
    const waitingPix = order.status === 'pending' && order.payment_method === 'pix' && order.pix_payload
    const summary = {
      status: order.status,
      product: order.store_products.name,
      priceCents: order.total_cents ?? order.price_cents,
      installments: order.installments,
      method: order.payment_method,
      salesUrl: order.store_products.sales_url,
      items: items.map((item) => ({ slug: item.product_slug, name: item.store_products.name, coverUrl: item.store_products.cover_url })),
      pix: waitingPix ? { payload: order.pix_payload, qrBase64: order.pix_qr_base64, expiresAt: order.pix_expires_at } : null,
    }
    if (parsed.data.action === 'status') return json(summary)

    if (order.status !== 'paid') return errorResponse(409, 'order_not_paid', 'O pagamento ainda não foi confirmado.')
    const item = items.find((candidate) => candidate.product_slug === (parsed.data.item ?? items[0]?.product_slug))
    if (!item) return errorResponse(404, 'item_not_found', 'Esse produto não faz parte do pedido.')
    if (item.downloads >= MAX_DOWNLOADS) {
      return errorResponse(429, 'download_limit', 'Esse produto chegou ao limite de downloads. Responda o e-mail de entrega que a gente libera.')
    }

    const { data: signed, error } = await admin.storage
      .from('store')
      .createSignedUrl(item.store_products.file_path, SIGNED_URL_SECONDS, { download: item.store_products.file_name })
    if (error || !signed) throw new Error(`signed url: ${error?.message}`)
    await admin
      .from('store_order_items')
      .update({ downloads: item.downloads + 1 })
      .eq('order_id', order.id)
      .eq('product_slug', item.product_slug)
    return json({ ...summary, url: signed.signedUrl })
  }),
)
