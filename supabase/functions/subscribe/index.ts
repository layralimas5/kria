// POST { plan }
// Cria a assinatura pendente e o checkout recorrente do Asaas; devolve o link.
// O plano e os créditos só entram quando o asaas-webhook confirma a cobrança.
// Assinar outro plano com um ativo é troca: o antigo acaba quando o novo pagar.

import { z } from 'npm:zod@3'
import { AsaasError, createSubscriptionCheckout } from '../_shared/asaas.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, isSuspended, json, readJson, requireEnv } from '../_shared/http.ts'

const bodySchema = z.object({ plan: z.string().regex(/^[a-z0-9-]{2,40}$/) })

const MAX_PENDING_PER_HOUR = 5

interface PlanRow {
  readonly slug: string
  readonly name: string
  readonly price_cents: number
  readonly monthly_credits: number
  readonly version: number
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')
    if (await isSuspended(admin, userId)) return errorResponse(403, 'account_suspended', 'Sua conta está suspensa. Fale com o suporte.')

    const { data: plan } = await admin
      .from('subscription_plans')
      .select('slug, name, price_cents, monthly_credits, version')
      .eq('slug', parsed.data.plan)
      .eq('active', true)
      .eq('public', true)
      .maybeSingle<PlanRow>()
    if (!plan) return errorResponse(404, 'plan_not_found', 'Plano não encontrado.')

    const { data: live } = await admin
      .from('subscriptions')
      .select('plan_slug')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due'])
      .maybeSingle<{ plan_slug: string }>()
    if (live?.plan_slug === plan.slug) return errorResponse(409, 'already_subscribed', 'Você já está nesse plano.')

    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('created_at', anHourAgo)
    if ((count ?? 0) >= MAX_PENDING_PER_HOUR) {
      return errorResponse(429, 'too_many_checkouts', 'Muitas tentativas abertas. Conclua uma ou tente mais tarde.')
    }

    const { data: subscription, error } = await admin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_slug: plan.slug,
        plan_version: plan.version,
        price_cents: plan.price_cents,
        monthly_credits: plan.monthly_credits,
      })
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
        successUrl: `${appUrl}/assinatura?assinatura=${subscription.id}`,
        cancelUrl: `${appUrl}/assinatura`,
      })
      await admin
        .from('subscriptions')
        .update({ provider_checkout_id: checkout.id, checkout_url: checkout.link, updated_at: new Date().toISOString() })
        .eq('id', subscription.id)
      return json({ url: checkout.link }, 201)
    } catch (checkoutError) {
      console.error('subscription checkout failed', checkoutError instanceof AsaasError ? checkoutError.body : checkoutError)
      await admin.from('subscriptions').update({ status: 'expired', ended_at: new Date().toISOString() }).eq('id', subscription.id)
      return errorResponse(502, 'payment_unavailable', 'O pagamento não abriu agora. Tente de novo em instantes.')
    }
  }),
)
