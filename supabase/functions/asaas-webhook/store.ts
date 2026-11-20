// Pedidos da loja de infoprodutos dentro do asaas-webhook (docs/loja.md).
// Pago = libera a página do pedido e manda o link por e-mail, uma vez só, mesmo com CHECKOUT_PAID e
// PAYMENT_CONFIRMED chegando juntos. Estorno bloqueia o download.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { getCustomerContact } from '../_shared/asaas.ts'
import { requireEnv } from '../_shared/http.ts'
import { sendDeliveryEmail } from '../_shared/storeEmail.ts'

const now = () => new Date().toISOString()

/** Marca pago (de pendente, expirado ou falho: cobrança confirmada pelo Asaas sempre vale) e tenta a entrega. */
export async function markStoreOrderPaid(
  admin: SupabaseClient,
  orderId: string,
  paymentId: string | null,
  customerId: string | null,
): Promise<string> {
  const { data: changed, error } = await admin
    .from('store_orders')
    .update({ status: 'paid', paid_at: now(), updated_at: now() })
    .eq('id', orderId)
    .in('status', ['pending', 'expired', 'failed'])
    .select('id')
  if (error) throw new Error(`store paid: ${error.message}`)

  if (paymentId || customerId) {
    const ids: Record<string, string> = {}
    if (paymentId) ids.provider_payment_id = paymentId
    if (customerId) ids.provider_customer_id = customerId
    await admin.from('store_orders').update({ ...ids, updated_at: now() }).eq('id', orderId)
  }

  const delivery = await deliverByEmail(admin, orderId)
  return `${changed && changed.length > 0 ? 'pedido pago' : 'pedido já pago'}; ${delivery}`
}

interface DeliveryRow {
  readonly access_token: string
  readonly status: string
  readonly provider_customer_id: string | null
  readonly email_sent_at: string | null
  readonly buyer_email: string | null
  readonly buyer_name: string | null
  readonly store_order_items: readonly { readonly store_products: { readonly name: string } }[]
}

/** Contato de quem comprou: o do nosso checkout; nos pedidos antigos (checkout do Asaas), o do cliente lá. */
async function buyerContact(admin: SupabaseClient, orderId: string, order: DeliveryRow) {
  if (order.buyer_email) return { email: order.buyer_email, name: order.buyer_name }
  if (!order.provider_customer_id) return null
  const contact = await getCustomerContact(order.provider_customer_id)
  await admin.from('store_orders').update({ buyer_email: contact.email, buyer_name: contact.name }).eq('id', orderId)
  return contact
}

async function deliverByEmail(admin: SupabaseClient, orderId: string): Promise<string> {
  const { data: order } = await admin
    .from('store_orders')
    .select('access_token, status, provider_customer_id, email_sent_at, buyer_email, buyer_name, store_order_items(store_products(name))')
    .eq('id', orderId)
    .single<DeliveryRow>()
  if (!order || order.status !== 'paid') return 'sem entrega'
  if (order.email_sent_at) return 'e-mail já enviado'
  if (!order.buyer_email && !order.provider_customer_id) return 'e-mail espera a cobrança'

  // Reserva o envio antes de mandar: dois eventos ao mesmo tempo não mandam dois e-mails.
  const { data: claimed } = await admin
    .from('store_orders')
    .update({ email_sent_at: now() })
    .eq('id', orderId)
    .is('email_sent_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return 'e-mail já enviado'

  try {
    const contact = await buyerContact(admin, orderId, order)
    if (!contact?.email) throw new Error('pedido sem e-mail de quem comprou')
    const sent = await sendDeliveryEmail({
      to: contact.email,
      buyerName: contact.name,
      productName: order.store_order_items.map((item) => item.store_products.name).join(' + '),
      accessUrl: `${requireEnv('APP_URL')}/pedido/${order.access_token}`,
    })
    if (!sent) {
      await admin.from('store_orders').update({ email_sent_at: null }).eq('id', orderId)
      return 'e-mail desligado (sem RESEND_API_KEY)'
    }
    return 'e-mail enviado'
  } catch (sendError) {
    await admin.from('store_orders').update({ email_sent_at: null }).eq('id', orderId)
    console.error('store delivery email', orderId, sendError)
    return `e-mail falhou: ${sendError instanceof Error ? sendError.message : 'desconhecido'}`
  }
}

export async function expireStoreOrder(admin: SupabaseClient, orderId: string): Promise<string> {
  await admin.from('store_orders').update({ status: 'expired', updated_at: now() }).eq('id', orderId).eq('status', 'pending')
  return 'pedido da loja expirado'
}

/** Cartão recusado depois de criado ou Pix vencido sem pagar: nada foi cobrado. */
export async function failStoreOrder(admin: SupabaseClient, orderId: string, reason: string): Promise<string> {
  await admin.from('store_orders').update({ status: 'failed', updated_at: now() }).eq('id', orderId).eq('status', 'pending')
  return `pedido da loja não concluído: ${reason}`
}

export async function refundStoreOrder(admin: SupabaseClient, orderId: string): Promise<string> {
  await admin.from('store_orders').update({ status: 'refunded', refunded_at: now(), updated_at: now() }).eq('id', orderId)
  return 'pedido da loja estornado: download bloqueado'
}
