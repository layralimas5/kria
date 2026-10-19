// POST { pack }
// Cria a compra pendente e o checkout do Asaas; devolve o link de pagamento.
// O crédito só entra quando o asaas-webhook confirma o pagamento.

import { z } from 'npm:zod@3'
import { AsaasError, createCreditCheckout } from '../_shared/asaas.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, isSuspended, json, readJson, requireEnv } from '../_shared/http.ts'

const bodySchema = z.object({ pack: z.string().regex(/^[a-z0-9-]{2,40}$/) })

const MAX_PENDING_PER_HOUR = 5

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')
    if (await isSuspended(admin, userId)) return errorResponse(403, 'account_suspended', 'Sua conta está suspensa. Fale com o suporte.')

    const { data: pack } = await admin
      .from('credit_packs')
      .select('slug, name, credits, price_cents')
      .eq('slug', parsed.data.pack)
      .eq('active', true)
      .maybeSingle<{ slug: string; name: string; credits: number; price_cents: number }>()
    if (!pack) return errorResponse(404, 'pack_not_found', 'Pacote não encontrado.')

    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('created_at', anHourAgo)
    if ((count ?? 0) >= MAX_PENDING_PER_HOUR) {
      return errorResponse(429, 'too_many_checkouts', 'Muitas compras abertas. Conclua uma ou tente mais tarde.')
    }

    const { data: purchase, error } = await admin
      .from('purchases')
      .insert({ user_id: userId, pack_slug: pack.slug, credits: pack.credits, price_cents: pack.price_cents })
      .select('id')
      .single<{ id: string }>()
    if (error || !purchase) throw new Error(`insert purchase: ${error?.message}`)

    const appUrl = requireEnv('APP_URL')
    try {
      const checkout = await createCreditCheckout({
        purchaseId: purchase.id,
        packName: pack.name,
        credits: pack.credits,
        priceCents: pack.price_cents,
        successUrl: `${appUrl}/creditos?compra=${purchase.id}`,
        cancelUrl: `${appUrl}/creditos`,
      })
      await admin
        .from('purchases')
        .update({ provider_checkout_id: checkout.id, checkout_url: checkout.link })
        .eq('id', purchase.id)
      return json({ url: checkout.link }, 201)
    } catch (checkoutError) {
      console.error('checkout failed', checkoutError instanceof AsaasError ? checkoutError.body : checkoutError)
      await admin.from('purchases').update({ status: 'expired' }).eq('id', purchase.id)
      return errorResponse(502, 'payment_unavailable', 'O pagamento não abriu agora. Tente de novo em instantes.')
    }
  }),
)
