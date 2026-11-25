// Avisa no aparelho de quem administra quando entra dinheiro (docs/app-e-notificacoes.md).
// Só é chamado quando o pagamento acabou de ser aplicado (ativou o período, creditou o pacote,
// pagou o pedido): CONFIRMED e RECEIVED da mesma cobrança não avisam duas vezes.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { sendPush } from '../_shared/push.ts'
import { saleMessage, type Sale } from '../_shared/pushMessages.ts'

async function notify(admin: SupabaseClient, load: () => Promise<Sale | null>): Promise<void> {
  try {
    const sale = await load()
    if (sale) await sendPush(admin, saleMessage(sale))
  } catch (error) {
    console.error('aviso de venda', error)
  }
}

export function notifyPlanSale(admin: SupabaseClient, subscriptionId: string, paymentId: string, amountCents: number): Promise<void> {
  return notify(admin, async () => {
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('plan_slug, subscription_plans(name)')
      .eq('id', subscriptionId)
      .maybeSingle<{ plan_slug: string; subscription_plans: { name: string } | null }>()
    if (!subscription) return null
    const { count } = await admin
      .from('subscription_payments')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_id', subscriptionId)
    return {
      kind: 'plan',
      planName: subscription.subscription_plans?.name ?? subscription.plan_slug,
      amountCents,
      firstPayment: (count ?? 0) <= 1,
      id: paymentId,
    }
  })
}

export function notifyPackSale(admin: SupabaseClient, purchaseId: string): Promise<void> {
  return notify(admin, async () => {
    const { data } = await admin
      .from('purchases')
      .select('credits, price_cents, pack_slug, credit_packs(name)')
      .eq('id', purchaseId)
      .maybeSingle<{ credits: number; price_cents: number; pack_slug: string; credit_packs: { name: string } | null }>()
    if (!data) return null
    return { kind: 'pack', packName: data.credit_packs?.name ?? data.pack_slug, credits: data.credits, amountCents: data.price_cents, id: purchaseId }
  })
}

/** Pedido da loja avulso. O "leve junto" do checkout de plano já entra no aviso da assinatura. */
export function notifyStoreSale(admin: SupabaseClient, orderId: string): Promise<void> {
  return notify(admin, async () => {
    const { data } = await admin
      .from('store_orders')
      .select('total_cents, subscription_id, store_order_items(store_products(name))')
      .eq('id', orderId)
      .maybeSingle<{
        total_cents: number
        subscription_id: string | null
        store_order_items: readonly { store_products: { name: string } | null }[]
      }>()
    if (!data || data.subscription_id) return null
    const products = data.store_order_items.flatMap((item) => (item.store_products ? [item.store_products.name] : []))
    return { kind: 'store', products, amountCents: data.total_cents, id: orderId }
  })
}
