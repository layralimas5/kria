// POST { plan, method?: 'card' | 'pix', name?, cpf? }
// Cria a assinatura pendente e devolve o link de pagamento:
//   cartão  checkout recorrente do Asaas (guarda o cartão e cobra todo mês)
//   Pix     assinatura pela API do Asaas (uma cobrança Pix por mês); o link é a
//           fatura da primeira cobrança, com o QR Code. O checkout do Asaas não
//           aceita Pix em cobrança recorrente, por isso o Pix pede nome e CPF aqui.
// O plano e os créditos só entram quando o asaas-webhook confirma a cobrança.
// Assinar outro plano com um ativo é troca: o antigo acaba quando o novo pagar.
// O CPF vai só para o Asaas; não é guardado no banco do Vynkio.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { AsaasError, createPixSubscription, createSubscriptionCheckout, deleteSubscription } from '../_shared/asaas.ts'
import { isValidCpf } from '../_shared/billing.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, isSuspended, json, readJson, requireEnv } from '../_shared/http.ts'

const bodySchema = z.object({
  plan: z.string().regex(/^[a-z0-9-]{2,40}$/),
  method: z.enum(['card', 'pix']).default('card'),
  name: z.string().trim().min(3).max(100).optional(),
  cpf: z.string().max(20).optional(),
})

const MAX_PENDING_PER_HOUR = 5

interface PlanRow {
  readonly slug: string
  readonly name: string
  readonly price_cents: number
  readonly monthly_credits: number
  readonly version: number
}

/**
 * Pix pendente que ficou para trás (a pessoa tentou de novo) continuaria gerando cobrança todo mês
 * no Asaas. Antes de abrir outra, as antigas são canceladas lá e expiram aqui.
 */
async function closeStalePixAttempts(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: stale } = await admin
    .from('subscriptions')
    .select('id, provider_subscription_id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .not('provider_subscription_id', 'is', null)
  for (const row of stale ?? []) {
    await deleteSubscription(row.provider_subscription_id as string)
    await admin.from('subscriptions').update({ status: 'expired', ended_at: new Date().toISOString() })
      .eq('id', row.id).eq('status', 'pending')
  }
}

async function userEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')
    const body = parsed.data
    const cpf = body.cpf?.replace(/\D/g, '') ?? ''
    if (body.method === 'pix') {
      if (!body.name) return errorResponse(400, 'invalid_name', 'Informe o nome completo.')
      if (!isValidCpf(cpf)) return errorResponse(400, 'invalid_cpf', 'CPF inválido. Confira os números.')
    }
    if (await isSuspended(admin, userId)) return errorResponse(403, 'account_suspended', 'Sua conta está suspensa. Fale com o suporte.')

    const { data: plan } = await admin
      .from('subscription_plans')
      .select('slug, name, price_cents, monthly_credits, version')
      .eq('slug', body.plan)
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

    try {
      if (body.method === 'pix') {
        await closeStalePixAttempts(admin, userId)
        const pix = await createPixSubscription({
          subscriptionId: subscription.id,
          planName: plan.name,
          monthlyCredits: plan.monthly_credits,
          priceCents: plan.price_cents,
          payer: { name: body.name ?? '', cpf, email: await userEmail(admin, userId), userId },
        })
        await admin
          .from('subscriptions')
          .update({
            provider_subscription_id: pix.providerSubscriptionId,
            provider_customer_id: pix.customerId,
            checkout_url: pix.invoiceUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)
        return json({ url: pix.invoiceUrl }, 201)
      }

      const appUrl = requireEnv('APP_URL')
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
      console.error('subscription checkout failed', body.method, checkoutError instanceof AsaasError ? checkoutError.body : checkoutError)
      await admin.from('subscriptions').update({ status: 'expired', ended_at: new Date().toISOString() }).eq('id', subscription.id)
      return errorResponse(502, 'payment_unavailable', 'O pagamento não abriu agora. Tente de novo em instantes.')
    }
  }),
)
