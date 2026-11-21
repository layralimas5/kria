// POST { action: 'offer', product }  → o que o checkout mostra (capa, preço, "leve junto", parcelas)
// POST { action: 'pay', method, product, bumps, buyer, card?, expectedTotalCents }  → cobra
// Checkout próprio da loja (docs/loja.md): a pessoa paga na página do Vynkio, sem a tela do Asaas.
//   Pix     cria a cobrança e devolve o QR e o copia e cola; o pedido vira pago pelo asaas-webhook.
//   cartão  cobra na hora pela API do Asaas, parcelado com juros visíveis. O número do cartão só passa
//           por aqui a caminho do Asaas: não é gravado, não vai para log, não volta na resposta.
// Não pede conta no Vynkio. O pedido só vira pago pelo webhook; nada que venha do navegador libera
// download.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { AsaasError, CardDeclinedError, createCardCharge, createPixCharge, findOrCreateCustomer } from '../_shared/asaas.ts'
import { clientIp, sha256 } from '../_shared/clientIp.ts'
import { adminClient, errorResponse, handle, json, readJson } from '../_shared/http.ts'
import { bumpPrice, firstIssue, payBodySchema, quoteOrder, type OrderQuote, type PayBody, type StoreProduct } from '../_shared/storeCheckout.ts'

const offerSchema = z.object({ action: z.literal('offer'), product: z.string().regex(/^[a-z0-9-]{2,40}$/) })

/** Sem login, os freios são globais e por IP: segura robô testando cartão roubado. */
const MAX_PENDING_PER_10_MIN = 40
const MAX_ATTEMPTS_PER_IP_HOUR = 6

interface ProductRow extends StoreProduct {
  readonly tagline: string | null
  readonly cover_url: string | null
  readonly bump_pitch: string | null
  readonly sales_url: string
}

const PRODUCT_COLUMNS =
  'slug, name, tagline, cover_url, price_cents, max_installments, interest_monthly, bump_slugs, bump_price_cents, bump_pitch, sales_url'

async function loadOffer(admin: SupabaseClient, slug: string): Promise<{ main: ProductRow; bumps: ProductRow[] } | null> {
  const { data: main } = await admin.from('store_products').select(PRODUCT_COLUMNS).eq('slug', slug).eq('active', true).maybeSingle<ProductRow>()
  if (!main) return null
  if (main.bump_slugs.length === 0) return { main: normalize(main), bumps: [] }
  const { data: bumps } = await admin.from('store_products').select(PRODUCT_COLUMNS).in('slug', main.bump_slugs).eq('active', true)
  const rows = ((bumps ?? []) as ProductRow[]).map(normalize)
  // Na ordem que o produto principal definiu.
  return { main: normalize(main), bumps: main.bump_slugs.flatMap((bumpSlug) => rows.filter((row) => row.slug === bumpSlug)) }
}

/** O Postgres devolve numeric como texto. */
function normalize(row: ProductRow): ProductRow {
  return { ...row, interest_monthly: Number(row.interest_monthly) }
}

function offerResponse(main: ProductRow, bumps: readonly ProductRow[]) {
  return {
    product: { slug: main.slug, name: main.name, tagline: main.tagline, coverUrl: main.cover_url, priceCents: main.price_cents },
    bumps: bumps.map((bump) => ({
      slug: bump.slug,
      name: bump.name,
      pitch: bump.bump_pitch ?? bump.tagline,
      coverUrl: bump.cover_url,
      priceCents: bumpPrice(bump),
      fullPriceCents: bump.price_cents,
    })),
    maxInstallments: main.max_installments,
    interestMonthly: main.interest_monthly,
    salesUrl: main.sales_url,
  }
}

async function tooManyAttempts(admin: SupabaseClient, ipHash: string): Promise<string | null> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count: pending } = await admin
    .from('store_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('created_at', tenMinutesAgo)
  if ((pending ?? 0) >= MAX_PENDING_PER_10_MIN) return 'Muita gente comprando agora. Tente de novo em alguns minutos.'

  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: fromIp } = await admin
    .from('store_orders')
    .select('id', { count: 'exact', head: true })
    .eq('client_ip_hash', ipHash)
    .gte('created_at', anHourAgo)
  if ((fromIp ?? 0) >= MAX_ATTEMPTS_PER_IP_HOUR) return 'Muitas tentativas seguidas. Espere uma hora ou fale com o suporte.'
  return null
}

async function createOrder(admin: SupabaseClient, body: PayBody, quote: OrderQuote, ipHash: string) {
  const { data: order, error } = await admin
    .from('store_orders')
    .insert({
      product_slug: body.product,
      price_cents: quote.subtotalCents,
      total_cents: quote.totalCents,
      installments: quote.installments,
      payment_method: body.method,
      buyer_name: body.buyer.name,
      buyer_email: body.buyer.email,
      client_ip_hash: ipHash,
    })
    .select('id, access_token')
    .single<{ id: string; access_token: string }>()
  if (error || !order) throw new Error(`insert store order: ${error?.message}`)

  const { error: itemsError } = await admin.from('store_order_items').insert(
    quote.lines.map((line) => ({ order_id: order.id, product_slug: line.slug, price_cents: line.priceCents, is_bump: line.isBump })),
  )
  if (itemsError) throw new Error(`insert store order items: ${itemsError.message}`)
  return order
}

const setOrder = (admin: SupabaseClient, id: string, values: Record<string, unknown>) =>
  admin.from('store_orders').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id)

async function pay(request: Request, admin: SupabaseClient, body: PayBody): Promise<Response> {
  const offer = await loadOffer(admin, body.product)
  if (!offer) return errorResponse(404, 'product_not_found', 'Produto não encontrado.')

  let quote: OrderQuote
  try {
    quote = quoteOrder(offer.main, offer.bumps, body.bumps, body.method === 'card' ? body.card.installments : 1)
  } catch {
    return errorResponse(400, 'invalid_order', 'Essa combinação não está disponível. Recarregue a página.')
  }
  if (quote.totalCents !== body.expectedTotalCents) {
    return errorResponse(409, 'price_changed', 'O valor mudou desde que você abriu a página. Confira e tente de novo.')
  }

  const remoteIp = clientIp(request)
  const ipHash = await sha256(remoteIp)
  const blocked = await tooManyAttempts(admin, ipHash)
  if (blocked) return errorResponse(429, 'too_many_checkouts', blocked)

  const order = await createOrder(admin, body, quote, ipHash)
  const names = quote.lines.map((line) => line.name).join(' + ')
  const description = `${names} (pedido ${order.id.slice(0, 8)})`

  try {
    const customerId = await findOrCreateCustomer({
      name: body.buyer.name,
      cpf: body.buyer.cpf,
      email: body.buyer.email,
      phone: body.buyer.phone,
      externalReference: order.id,
    })
    await setOrder(admin, order.id, { provider_customer_id: customerId })

    if (body.method === 'pix') {
      const pix = await createPixCharge({ customerId, description, externalReference: order.id, valueCents: quote.totalCents })
      await setOrder(admin, order.id, {
        provider_payment_id: pix.paymentId,
        pix_payload: pix.payload,
        pix_qr_base64: pix.qrBase64,
        pix_expires_at: pix.expiresAt ? new Date(`${pix.expiresAt.replace(' ', 'T')}-03:00`).toISOString() : null,
      })
      return json({ token: order.access_token, pix: { payload: pix.payload, qrBase64: pix.qrBase64, expiresAt: pix.expiresAt } }, 201)
    }

    const charge = await createCardCharge({
      customerId,
      description,
      externalReference: order.id,
      totalCents: quote.totalCents,
      installments: quote.installments,
      card: {
        holderName: body.card.holderName,
        number: body.card.number,
        expiryMonth: body.card.expiryMonth,
        expiryYear: body.card.expiryYear,
        ccv: body.card.ccv,
      },
      holder: {
        name: body.buyer.name,
        email: body.buyer.email,
        cpf: body.buyer.cpf,
        postalCode: body.card.postalCode,
        addressNumber: body.card.addressNumber,
        phone: body.buyer.phone,
      },
      remoteIp,
    })
    await setOrder(admin, order.id, { provider_payment_id: charge.paymentId, provider_installment_id: charge.installmentId })
    return json({ token: order.access_token }, 201)
  } catch (chargeError) {
    await setOrder(admin, order.id, { status: 'failed' })
    if (chargeError instanceof CardDeclinedError) return errorResponse(402, 'card_declined', chargeError.message)
    // Só o corpo do Asaas vai para o log: ele não repete o cartão.
    console.error('store charge failed', body.method, chargeError instanceof AsaasError ? chargeError.body : String(chargeError))
    return errorResponse(502, 'payment_unavailable', 'O pagamento não abriu agora. Nada foi cobrado. Tente de novo em instantes.')
  }
}

Deno.serve(
  handle(async (request) => {
    const raw = await readJson(request)
    const admin = adminClient()

    const offer = offerSchema.safeParse(raw)
    if (offer.success) {
      const found = await loadOffer(admin, offer.data.product)
      if (!found) return errorResponse(404, 'product_not_found', 'Produto não encontrado.')
      return json(offerResponse(found.main, found.bumps))
    }

    const parsed = payBodySchema.safeParse(raw)
    if (!parsed.success) return errorResponse(400, 'invalid_body', firstIssue(parsed.error))
    return pay(request, admin, parsed.data)
  }),
)
