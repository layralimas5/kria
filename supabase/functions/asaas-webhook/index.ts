// Webhook do Asaas. Confere o token, registra o evento (repetido para aqui),
// ativa e renova assinaturas e credita compras avulsas quando o pagamento confirma.
//
// Deploy sem verificação de JWT (quem chama é o Asaas):
//   npx supabase functions deploy asaas-webhook --no-verify-jwt
// No painel do Asaas: eventos CHECKOUT_PAID, CHECKOUT_EXPIRED, CHECKOUT_CANCELED,
// PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED,
// PAYMENT_CHARGEBACK_REQUESTED, SUBSCRIPTION_DELETED e SUBSCRIPTION_INACTIVATED,
// com o ASAAS_WEBHOOK_TOKEN.
//
// Sempre responde 200 depois de registrar: erro nosso não pode fazer o Asaas
// pausar a fila. O que não deu para aplicar fica em billing_events.outcome.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { adminClient, errorResponse, handle, json, readJson, requireEnv } from '../_shared/http.ts'
import { timingSafeEqual } from '../_shared/signature.ts'
import { decideSubscriptionEvent, type SubscriptionDecision } from '../_shared/subscription-events.ts'

const eventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  checkout: z.object({ id: z.string(), externalReference: z.string().nullish() }).passthrough().optional(),
  payment: z
    .object({
      id: z.string(),
      checkoutSession: z.string().nullish(),
      externalReference: z.string().nullish(),
      subscription: z.string().nullish(),
      customer: z.string().nullish(),
      dueDate: z.string().nullish(),
    })
    .passthrough()
    .optional(),
  subscription: z.object({ id: z.string() }).passthrough().optional(),
})

type AsaasEvent = z.infer<typeof eventSchema>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAID = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CHECKOUT_PAID'])
const CLOSED = new Set(['CHECKOUT_EXPIRED', 'CHECKOUT_CANCELED'])
const REFUNDED = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'])

async function findPurchaseId(admin: SupabaseClient, event: AsaasEvent): Promise<string | null> {
  const checkoutId = event.checkout?.id ?? event.payment?.checkoutSession ?? null
  if (checkoutId) {
    const { data } = await admin.from('purchases').select('id').eq('provider_checkout_id', checkoutId).maybeSingle()
    if (data?.id) return data.id as string
  }
  const reference = event.checkout?.externalReference ?? event.payment?.externalReference ?? null
  if (reference && UUID.test(reference)) {
    const { data } = await admin.from('purchases').select('id').eq('id', reference).maybeSingle()
    if (data?.id) return data.id as string
  }
  return null
}

async function findSubscriptionId(
  admin: SupabaseClient,
  providerSubscriptionId: string,
  checkoutSessionId: string | null,
): Promise<string | null> {
  const { data } = await admin.from('subscriptions').select('id').eq('provider_subscription_id', providerSubscriptionId).maybeSingle()
  if (data?.id) return data.id as string
  // Primeira cobrança: ainda não sabemos o id da assinatura no Asaas, só o checkout que a criou.
  if (!checkoutSessionId) return null
  const first = await admin.from('subscriptions').select('id').eq('provider_checkout_id', checkoutSessionId).maybeSingle()
  return (first.data?.id as string | undefined) ?? null
}

async function applySubscription(admin: SupabaseClient, decision: Exclude<SubscriptionDecision, { kind: 'not_subscription' }>): Promise<string> {
  if (decision.kind === 'ignored') return `ignorado: ${decision.reason}`
  const now = new Date().toISOString()

  if (decision.kind === 'paid') {
    const subscriptionId = await findSubscriptionId(admin, decision.providerSubscriptionId, decision.checkoutSessionId)
    if (!subscriptionId) return 'assinatura não encontrada'
    const { data, error } = await admin.rpc('grant_subscription_payment', {
      p_subscription_id: subscriptionId,
      p_payment_id: decision.paymentId,
      p_provider_subscription_id: decision.providerSubscriptionId,
      p_customer_id: decision.customerId,
      p_period_end: decision.periodEnd.toISOString(),
    })
    if (error) return `erro ao liberar assinatura: ${error.message}`
    return data ? 'assinatura liberada' : 'cobrança já liberada'
  }

  if (decision.kind === 'overdue') {
    await admin
      .from('subscriptions')
      .update({ status: 'overdue', updated_at: now })
      .eq('provider_subscription_id', decision.providerSubscriptionId)
      .eq('status', 'active')
    return 'assinatura em atraso'
  }
  if (decision.kind === 'refunded') {
    // Estorno corta o plano na hora; créditos já usados não voltam automaticamente.
    await admin
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: now, current_period_end: now, updated_at: now })
      .eq('provider_subscription_id', decision.providerSubscriptionId)
    return 'assinatura estornada: revisar saldo manualmente'
  }
  await admin
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: now, updated_at: now })
    .eq('provider_subscription_id', decision.providerSubscriptionId)
    .in('status', ['active', 'overdue'])
  return 'assinatura encerrada no fim do período pago'
}

async function expireSubscriptionCheckout(admin: SupabaseClient, checkoutId: string | undefined): Promise<boolean> {
  if (!checkoutId) return false
  const { data } = await admin
    .from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('provider_checkout_id', checkoutId)
    .eq('status', 'pending')
    .select('id')
  return (data?.length ?? 0) > 0
}

async function apply(admin: SupabaseClient, event: AsaasEvent): Promise<string> {
  const subscriptionDecision = decideSubscriptionEvent(event)
  if (subscriptionDecision.kind !== 'not_subscription') return applySubscription(admin, subscriptionDecision)
  if (CLOSED.has(event.event) && (await expireSubscriptionCheckout(admin, event.checkout?.id))) return 'checkout de assinatura expirado'

  const handled = PAID.has(event.event) || CLOSED.has(event.event) || REFUNDED.has(event.event)
  if (!handled) return `ignorado: ${event.event}`

  const purchaseId = await findPurchaseId(admin, event)
  if (!purchaseId) return 'compra não encontrada'

  if (PAID.has(event.event)) {
    const { data, error } = await admin.rpc('grant_purchase', {
      p_purchase_id: purchaseId,
      p_payment_id: event.payment?.id ?? null,
    })
    if (error) return `erro ao creditar: ${error.message}`
    return data ? 'creditado' : 'já creditado'
  }

  if (CLOSED.has(event.event)) {
    await admin.from('purchases').update({ status: 'expired' }).eq('id', purchaseId).eq('status', 'pending')
    return 'expirado'
  }

  // Estorno não tira crédito automaticamente: o saldo pode já ter sido gasto.
  await admin.from('purchases').update({ status: 'refunded' }).eq('id', purchaseId)
  return 'estornado: revisar saldo manualmente'
}

Deno.serve(
  handle(async (request) => {
    const token = request.headers.get('asaas-access-token') ?? ''
    if (!timingSafeEqual(token, requireEnv('ASAAS_WEBHOOK_TOKEN'))) {
      return errorResponse(401, 'invalid_token', 'Token inválido.')
    }

    const payload = await readJson(request)
    const parsed = eventSchema.safeParse(payload)
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
      outcome = await apply(admin, event)
    } catch (error) {
      console.error('asaas apply failed', event.id, error)
      outcome = `erro: ${error instanceof Error ? error.message : 'desconhecido'}`
    }
    await admin.from('billing_events').update({ outcome }).eq('id', event.id)
    return json({ outcome })
  }),
)
