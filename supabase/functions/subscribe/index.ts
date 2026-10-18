// POST { plan }
// Sem assinatura: cria a assinatura pendente e o checkout recorrente do Asaas,
// devolve { url }. Com assinatura ativa em outro plano: troca o plano
// (limites na hora, valor e créditos novos a partir da próxima cobrança),
// devolve { changed: true }. Nada é liberado aqui: quem ativa é o asaas-webhook.

import { z } from 'npm:zod@3'
import { AsaasError, createSubscriptionCheckout, updateSubscriptionValue } from '../_shared/asaas.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, json, readJson, requireEnv } from '../_shared/http.ts'

const bodySchema = z.object({ plan: z.string().regex(/^[a-z0-9-]{2,40}$/) })

interface Plan {
  readonly slug: string
  readonly name: string
  readonly price_cents: number
  readonly monthly_credits: number
}

interface OpenSubscription {
  readonly id: string
  readonly plan_slug: string
  readonly status: 'pending' | 'active' | 'overdue'
  readonly provider_subscription_id: string | null
  readonly checkout_url: string | null
  readonly created_at: string
}

const CHECKOUT_REUSE_MS = 50 * 60 * 1000

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')

    const { data: plan } = await admin
      .from('subscription_plans')
      .select('slug, name, price_cents, monthly_credits')
      .eq('slug', parsed.data.plan)
      .eq('active', true)
      .maybeSingle<Plan>()
    if (!plan) return errorResponse(404, 'plan_not_found', 'Plano não encontrado.')

    const { data: open } = await admin
      .from('subscriptions')
      .select('id, plan_slug, status, provider_subscription_id, checkout_url, created_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'active', 'overdue'])
      .maybeSingle<OpenSubscription>()

    if (open && open.status !== 'pending') return changePlan(admin, open, plan)

    if (open?.status === 'pending') {
      const fresh = Date.now() - new Date(open.created_at).getTime() < CHECKOUT_REUSE_MS
      if (fresh && open.plan_slug === plan.slug && open.checkout_url) return json({ url: open.checkout_url })
      await admin.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', open.id)
    }

    const { data: subscription, error } = await admin
      .from('subscriptions')
      .insert({ user_id: userId, plan_slug: plan.slug, price_cents: plan.price_cents })
      .select('id')
      .single<{ id: string }>()
    if (error || !subscription) throw new Error(`insert subscription: ${error?.message}`)

    const appUrl = requireEnv('APP_URL')
    try {
      const checkout = await createSubscriptionCheckout({
        subscriptionId: subscription.id,
        planName: plan.name,
        monthlyCredits: plan.monthly_credits,
        priceCents: plan.price_cents,
        successUrl: `${appUrl}/conta/assinatura?retorno=${subscription.id}`,
        cancelUrl: `${appUrl}/#precos`,
      })
      await admin
        .from('subscriptions')
        .update({ provider_checkout_id: checkout.id, checkout_url: checkout.link })
        .eq('id', subscription.id)
      return json({ url: checkout.link }, 201)
    } catch (checkoutError) {
      console.error('subscription checkout failed', checkoutError instanceof AsaasError ? checkoutError.body : checkoutError)
      await admin.from('subscriptions').update({ status: 'expired' }).eq('id', subscription.id)
      return errorResponse(502, 'payment_unavailable', 'O pagamento não abriu agora. Tente de novo em instantes.')
    }
  }),
)

async function changePlan(admin: ReturnType<typeof adminClient>, open: OpenSubscription, plan: Plan): Promise<Response> {
  if (open.plan_slug === plan.slug) return errorResponse(409, 'already_subscribed', 'Você já está nesse plano.')
  if (open.status === 'overdue') {
    return errorResponse(409, 'subscription_overdue', 'Sua assinatura tem uma cobrança em aberto. Regularize antes de trocar de plano.')
  }
  if (!open.provider_subscription_id) return errorResponse(409, 'subscription_not_ready', 'Sua assinatura ainda está sendo confirmada.')

  try {
    await updateSubscriptionValue(open.provider_subscription_id, plan.price_cents, `${plan.name}: ${plan.monthly_credits} créditos por mês`)
  } catch (updateError) {
    console.error('plan change failed', updateError instanceof AsaasError ? updateError.body : updateError)
    return errorResponse(502, 'payment_unavailable', 'Não deu para trocar o plano agora. Tente de novo em instantes.')
  }
  await admin
    .from('subscriptions')
    .update({ plan_slug: plan.slug, price_cents: plan.price_cents, updated_at: new Date().toISOString() })
    .eq('id', open.id)
  return json({ changed: true })
}
