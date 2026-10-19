// Webhook do Asaas. Confere o token, registra o evento (repetido para aqui)
// e aplica: pacote pago credita, ciclo de assinatura pago renova os créditos
// do plano, atraso e cancelamento mudam o status da assinatura.
//
// Deploy sem verificação de JWT (quem chama é o Asaas):
//   npx supabase functions deploy asaas-webhook --no-verify-jwt
// No painel do Asaas: eventos CHECKOUT_PAID, CHECKOUT_EXPIRED, CHECKOUT_CANCELED,
// PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED,
// SUBSCRIPTION_DELETED e SUBSCRIPTION_INACTIVATED, com o ASAAS_WEBHOOK_TOKEN.
//
// Plano e crédito só mudam aqui, por evento autenticado do Asaas. Nada que
// venha do navegador libera plano.
//
// Sempre responde 200 depois de registrar: erro nosso não pode fazer o Asaas
// pausar a fila. O que não deu para aplicar fica em billing_events.outcome.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { deleteSubscription, getSubscription } from '../_shared/asaas.ts'
import { asaasEventSchema, decideBillingEvent, type BillingAction, type Lookup } from '../_shared/billing.ts'
import { adminClient, errorResponse, handle, json, readJson, requireEnv } from '../_shared/http.ts'
import { timingSafeEqual } from '../_shared/signature.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Table = 'purchases' | 'subscriptions'

/** Acha a nossa linha pelo checkout ou pela referência externa (o id que mandamos ao Asaas). */
async function findRow(admin: SupabaseClient, table: Table, lookup: Lookup): Promise<string | null> {
  if (lookup.checkoutId) {
    const { data } = await admin.from(table).select('id').eq('provider_checkout_id', lookup.checkoutId).maybeSingle()
    if (data?.id) return data.id as string
  }
  if (lookup.externalReference && UUID.test(lookup.externalReference)) {
    const { data } = await admin.from(table).select('id').eq('id', lookup.externalReference).maybeSingle()
    if (data?.id) return data.id as string
  }
  return null
}

async function findSubscription(admin: SupabaseClient, providerSubscriptionId: string, lookup?: Lookup): Promise<string | null> {
  const { data } = await admin
    .from('subscriptions')
    .select('id')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle()
  if (data?.id) return data.id as string
  if (lookup) {
    const found = await findRow(admin, 'subscriptions', lookup)
    if (found) return found
  }
  // O PAYMENT_CONFIRMED pode chegar antes de sabermos o id da assinatura no Asaas:
  // a assinatura de lá carrega a referência do checkout, que é o nosso id.
  const remote = await getSubscription(providerSubscriptionId).catch(() => null)
  return remote ? findRow(admin, 'subscriptions', { checkoutId: null, externalReference: remote.externalReference }) : null
}

async function setStatus(admin: SupabaseClient, id: string, status: 'past_due' | 'canceled' | 'expired'): Promise<boolean> {
  const { data, error } = await admin.rpc('set_subscription_status', { p_subscription_id: id, p_status: status })
  if (error) throw new Error(`set_subscription_status: ${error.message}`)
  return data === true
}

async function grantPack(admin: SupabaseClient, purchaseId: string, paymentId: string | null): Promise<string> {
  const { data, error } = await admin.rpc('grant_purchase', { p_purchase_id: purchaseId, p_payment_id: paymentId })
  if (error) return `erro ao creditar: ${error.message}`
  return data ? 'creditado' : 'já creditado'
}

async function activatePeriod(admin: SupabaseClient, action: Extract<BillingAction, { kind: 'subscription_paid' }>): Promise<string> {
  const subscriptionId = await findSubscription(admin, action.providerSubscriptionId, action.lookup)
  if (!subscriptionId) return `assinatura não encontrada: ${action.providerSubscriptionId}`

  const { data, error } = await admin.rpc('activate_subscription_period', {
    p_subscription_id: subscriptionId,
    p_payment_id: action.paymentId,
    p_amount_cents: action.amountCents,
    p_due_date: action.dueDate,
    p_invoice_url: action.invoiceUrl,
    p_provider_subscription_id: action.providerSubscriptionId,
    p_provider_customer_id: action.customerId,
  })
  if (error) return `erro ao ativar: ${error.message}`
  const result = data as { outcome: string; replaced: string[] }

  // Troca de plano: a cobrança recorrente antiga para de existir no Asaas.
  const failures: string[] = []
  for (const oldId of result.replaced ?? []) {
    if (oldId === action.providerSubscriptionId) continue
    await deleteSubscription(oldId).catch((deleteError) => {
      console.error('cancelar assinatura antiga', oldId, deleteError)
      failures.push(oldId)
    })
  }
  return failures.length > 0 ? `${result.outcome}; cancelar no Asaas manualmente: ${failures.join(', ')}` : result.outcome
}

async function apply(admin: SupabaseClient, action: BillingAction): Promise<string> {
  switch (action.kind) {
    case 'ignore':
      return action.reason

    case 'checkout_paid': {
      const purchaseId = await findRow(admin, 'purchases', action.lookup)
      if (purchaseId) return grantPack(admin, purchaseId, null)
      // Assinatura: o crédito entra com o PAYMENT_CONFIRMED do ciclo, não aqui.
      const subscriptionId = await findRow(admin, 'subscriptions', action.lookup)
      return subscriptionId ? 'assinatura: aguardando a cobrança' : 'checkout não encontrado'
    }

    case 'checkout_closed': {
      const purchaseId = await findRow(admin, 'purchases', action.lookup)
      if (purchaseId) {
        await admin.from('purchases').update({ status: 'expired' }).eq('id', purchaseId).eq('status', 'pending')
        return 'compra expirada'
      }
      const subscriptionId = await findRow(admin, 'subscriptions', action.lookup)
      if (!subscriptionId) return 'checkout não encontrado'
      await admin.from('subscriptions').update({ status: 'expired', ended_at: new Date().toISOString() })
        .eq('id', subscriptionId).eq('status', 'pending')
      return 'checkout de assinatura expirado'
    }

    case 'pack_paid': {
      const purchaseId = await findRow(admin, 'purchases', action.lookup)
      return purchaseId ? grantPack(admin, purchaseId, action.paymentId) : 'compra não encontrada'
    }

    case 'pack_refunded': {
      const purchaseId = await findRow(admin, 'purchases', action.lookup)
      if (!purchaseId) return 'compra não encontrada'
      // Estorno não tira crédito automaticamente: o saldo pode já ter sido gasto.
      await admin.from('purchases').update({ status: 'refunded' }).eq('id', purchaseId)
      return 'estornado: revisar saldo manualmente'
    }

    case 'subscription_paid':
      return activatePeriod(admin, action)

    case 'subscription_overdue': {
      const id = await findSubscription(admin, action.providerSubscriptionId)
      if (!id) return 'assinatura não encontrada'
      return (await setStatus(admin, id, 'past_due')) ? 'em atraso' : 'sem efeito'
    }

    case 'subscription_refunded': {
      await admin.from('subscription_payments').update({ status: 'refunded' }).eq('provider_payment_id', action.paymentId)
      return 'cobrança do plano estornada: revisar saldo manualmente'
    }

    case 'subscription_ended': {
      const id = await findSubscription(admin, action.providerSubscriptionId, {
        checkoutId: null,
        externalReference: action.externalReference,
      })
      if (!id) return 'assinatura não encontrada'
      // Encerrada no Asaas: vale até o fim do período já pago.
      return (await setStatus(admin, id, 'canceled')) ? 'cancelada' : 'sem efeito'
    }
  }
}

Deno.serve(
  handle(async (request) => {
    const token = request.headers.get('asaas-access-token') ?? ''
    if (!timingSafeEqual(token, requireEnv('ASAAS_WEBHOOK_TOKEN'))) {
      return errorResponse(401, 'invalid_token', 'Token inválido.')
    }

    const payload = await readJson(request)
    const parsed = asaasEventSchema.safeParse(payload)
    if (!parsed.success) return json({ outcome: 'payload inválido' })
    const event = parsed.data

    const admin = adminClient()
    const { error: insertError } = await admin
      .from('billing_events')
      .insert({ id: event.id, event: event.event, payload })
    if (insertError) {
      if (insertError.code === '23505') return json({ outcome: 'repetido' })
      throw new Error(`billing_events: ${insertError.message}`)
    }

    let outcome: string
    try {
      outcome = await apply(admin, decideBillingEvent(event))
    } catch (error) {
      console.error('asaas apply failed', event.id, error)
      outcome = `erro: ${error instanceof Error ? error.message : 'desconhecido'}`
    }
    await admin.from('billing_events').update({ outcome }).eq('id', event.id)
    return json({ outcome })
  }),
)
