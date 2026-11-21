// Checkout próprio dos planos (docs/checkout-planos.md). Só com login: a assinatura é da conta.
// POST { action: 'offer', plan }   → plano, "leve junto" e o e-mail da conta
// POST { action: 'pay', ... }      → cria a assinatura no Asaas pela API e cobra
//   cartão  a primeira mensalidade sai na hora e o cartão fica guardado no Asaas para as próximas.
//           Os extras são uma cobrança à vista à parte no mesmo cartão (pedido da loja).
//   Pix     uma cobrança Pix por mês. Os extras entram na primeira mensalidade: o webhook separa o que é
//           do plano e o que é do pedido da loja. O QR aparece na própria página.
// POST { action: 'status', subscription } → status da assinatura (a página do Pix pergunta até pagar)
//
// O plano e os créditos só entram quando o asaas-webhook confirma a cobrança. Assinar outro plano com um
// ativo é troca: o antigo acaba quando o novo pagar. CPF e cartão vão só para o Asaas: não são gravados.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import {
  AsaasError,
  CardDeclinedError,
  createCardCharge,
  createCardSubscription,
  createPixSubscription,
  deleteSubscription,
  findOrCreateCustomer,
  getPixQrCode,
  setPixPaymentValue,
  type PixSubscription,
  type CardData,
  type CardHolder,
} from '../_shared/asaas.ts'
import { clientIp, sha256 } from '../_shared/clientIp.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, isSuspended, json, readJson } from '../_shared/http.ts'
import { planPayBodySchema, type PlanPayBody } from '../_shared/planCheckout.ts'
import { quotePlanOrder, type PlanBumpProduct, type PlanQuote } from '../_shared/planQuote.ts'
import { firstIssue, SLUG } from '../_shared/storeCheckout.ts'

const offerSchema = z.object({ action: z.literal('offer'), plan: SLUG })
const statusSchema = z.object({ action: z.literal('status'), subscription: z.string().uuid() })

const MAX_PENDING_PER_HOUR = 5

interface PlanRow {
  readonly slug: string
  readonly name: string
  readonly description: string | null
  readonly price_cents: number
  readonly monthly_credits: number
  readonly version: number
  readonly features: readonly string[]
  readonly storefront_features: readonly string[] | null
}

interface BumpRow extends PlanBumpProduct {
  readonly tagline: string | null
  readonly cover_url: string | null
  readonly bump_pitch: string | null
}

type Admin = SupabaseClient

async function loadPlan(admin: Admin, slug: string): Promise<PlanRow | null> {
  const { data } = await admin
    .from('subscription_plans')
    .select('slug, name, description, price_cents, monthly_credits, version, features, storefront_features')
    .eq('slug', slug)
    .eq('active', true)
    .eq('public', true)
    .maybeSingle<PlanRow>()
  return data
}

async function loadBumps(admin: Admin): Promise<BumpRow[]> {
  const { data } = await admin
    .from('store_products')
    .select('slug, name, tagline, cover_url, price_cents, bump_price_cents, bump_pitch')
    .eq('offer_on_plans', true)
    .eq('active', true)
    .order('created_at')
    .limit(3)
  return (data ?? []) as BumpRow[]
}

async function accountEmail(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

async function livePlanSlug(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('subscriptions')
    .select('plan_slug')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .maybeSingle<{ plan_slug: string }>()
  return data?.plan_slug ?? null
}

async function offer(admin: Admin, userId: string, slug: string): Promise<Response> {
  const plan = await loadPlan(admin, slug)
  if (!plan) return errorResponse(404, 'plan_not_found', 'Plano não encontrado.')
  const [bumps, email, current] = await Promise.all([loadBumps(admin), accountEmail(admin, userId), livePlanSlug(admin, userId)])
  return json({
    plan: {
      slug: plan.slug,
      name: plan.name,
      tagline: plan.description,
      priceCents: plan.price_cents,
      monthlyCredits: plan.monthly_credits,
      features: (plan.storefront_features ?? plan.features).slice(0, 6),
    },
    bumps: bumps.map((bump) => ({
      slug: bump.slug,
      name: bump.name,
      pitch: bump.bump_pitch ?? bump.tagline,
      coverUrl: bump.cover_url,
      priceCents: bump.bump_price_cents ?? bump.price_cents,
      fullPriceCents: bump.price_cents,
    })),
    email,
    alreadySubscribed: current === plan.slug,
  })
}

/**
 * Pix pendente que ficou para trás (a pessoa tentou de novo) continuaria gerando cobrança todo mês
 * no Asaas. Antes de abrir outra, as antigas são canceladas lá e expiram aqui, com os extras ligados a elas.
 */
async function closeStalePixAttempts(admin: Admin, userId: string): Promise<void> {
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
    await admin.from('store_orders').update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('subscription_id', row.id).eq('status', 'pending')
  }
}

async function tooManyPending(admin: Admin, userId: string): Promise<boolean> {
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('created_at', anHourAgo)
  return (count ?? 0) >= MAX_PENDING_PER_HOUR
}

interface Context {
  readonly admin: Admin
  readonly userId: string
  readonly email: string
  readonly plan: PlanRow
  readonly quote: PlanQuote
  readonly body: PlanPayBody
  readonly subscriptionId: string
  readonly customerId: string
  readonly remoteIp: string
  readonly ipHash: string
}

/** Os extras viram um pedido da loja da própria pessoa, ligado à assinatura. */
async function createBumpOrder(ctx: Context, providerPaymentId: string | null) {
  const [first] = ctx.quote.bumps
  if (!first) return null
  const { data: order, error } = await ctx.admin
    .from('store_orders')
    .insert({
      product_slug: first.slug,
      price_cents: ctx.quote.bumpsCents,
      total_cents: ctx.quote.bumpsCents,
      installments: 1,
      payment_method: ctx.body.method,
      buyer_name: ctx.body.buyer.name,
      buyer_email: ctx.email,
      client_ip_hash: ctx.ipHash,
      user_id: ctx.userId,
      subscription_id: ctx.subscriptionId,
      provider_customer_id: ctx.customerId,
      provider_payment_id: providerPaymentId,
    })
    .select('id, access_token')
    .single<{ id: string; access_token: string }>()
  if (error || !order) throw new Error(`insert bump order: ${error?.message}`)
  const { error: itemsError } = await ctx.admin
    .from('store_order_items')
    .insert(ctx.quote.bumps.map((line) => ({ order_id: order.id, product_slug: line.slug, price_cents: line.priceCents, is_bump: true })))
  if (itemsError) throw new Error(`insert bump items: ${itemsError.message}`)
  return order
}

const failOrder = (admin: Admin, id: string) =>
  admin.from('store_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending')

const setSubscription = (admin: Admin, id: string, values: Record<string, unknown>) =>
  admin.from('subscriptions').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id)

async function payWithCard(ctx: Context, card: Extract<PlanPayBody, { method: 'card' }>['card']): Promise<Response> {
  const cardData: CardData = {
    holderName: card.holderName,
    number: card.number,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    ccv: card.ccv,
  }
  const holder: CardHolder = {
    name: ctx.body.buyer.name,
    email: ctx.email,
    cpf: ctx.body.buyer.cpf,
    postalCode: card.postalCode,
    addressNumber: card.addressNumber,
    phone: ctx.body.buyer.phone,
  }
  const created = await createCardSubscription({
    subscriptionId: ctx.subscriptionId,
    customerId: ctx.customerId,
    planName: ctx.plan.name,
    monthlyCredits: ctx.plan.monthly_credits,
    priceCents: ctx.plan.price_cents,
    card: cardData,
    holder,
    remoteIp: ctx.remoteIp,
  })
  await setSubscription(ctx.admin, ctx.subscriptionId, {
    provider_subscription_id: created.providerSubscriptionId,
    provider_customer_id: ctx.customerId,
  })

  // Daqui em diante a mensalidade já foi cobrada: nada pode derrubar a assinatura, só os extras.
  if (ctx.quote.bumps.length === 0) return json({ subscriptionId: ctx.subscriptionId, orderToken: null, totalCents: ctx.quote.totalCents }, 201)
  let order: { id: string; access_token: string } | null = null
  try {
    order = await createBumpOrder(ctx, null)
    if (!order) throw new Error('bump order not created')
    const names = ctx.quote.bumps.map((line) => line.name).join(' + ')
    const charge = await createCardCharge({
      customerId: ctx.customerId,
      description: `${names} (pedido ${order.id.slice(0, 8)})`,
      externalReference: order.id,
      totalCents: ctx.quote.bumpsCents,
      installments: 1,
      card: cardData,
      holder,
      remoteIp: ctx.remoteIp,
    })
    await ctx.admin.from('store_orders').update({ provider_payment_id: charge.paymentId }).eq('id', order.id)
    return json({ subscriptionId: ctx.subscriptionId, orderToken: order.access_token, totalCents: ctx.quote.totalCents }, 201)
  } catch (bumpError) {
    // O plano já foi: só os extras ficam de fora, e a pessoa fica sabendo.
    if (order) await failOrder(ctx.admin, order.id)
    if (!(bumpError instanceof CardDeclinedError)) {
      console.error('bump charge failed', bumpError instanceof AsaasError ? bumpError.body : String(bumpError))
    }
    return json({ subscriptionId: ctx.subscriptionId, orderToken: null, totalCents: ctx.quote.planCents, bumpsFailed: true }, 201)
  }
}

async function payWithPix(ctx: Context): Promise<Response> {
  await closeStalePixAttempts(ctx.admin, ctx.userId)
  const pix = await createPixSubscription({
    subscriptionId: ctx.subscriptionId,
    planName: ctx.plan.name,
    monthlyCredits: ctx.plan.monthly_credits,
    priceCents: ctx.plan.price_cents,
    payer: { name: ctx.body.buyer.name, cpf: ctx.body.buyer.cpf, email: ctx.email, phone: ctx.body.buyer.phone, userId: ctx.userId },
  })
  try {
    return await finishPix(ctx, pix)
  } catch (error) {
    // Sem QR na tela a pessoa não paga: a assinatura de lá não pode ficar gerando cobrança.
    await deleteSubscription(pix.providerSubscriptionId).catch(() => undefined)
    throw error
  }
}

async function finishPix(ctx: Context, pix: PixSubscription): Promise<Response> {
  await setSubscription(ctx.admin, ctx.subscriptionId, {
    provider_subscription_id: pix.providerSubscriptionId,
    provider_customer_id: pix.customerId,
    checkout_url: pix.invoiceUrl,
  })

  let orderToken: string | null = null
  let totalCents = ctx.quote.planCents
  let bumpsFailed = false
  const order = await createBumpOrder(ctx, pix.firstPaymentId)
  if (order) {
    try {
      await setPixPaymentValue(pix.firstPaymentId, ctx.quote.totalCents)
      orderToken = order.access_token
      totalCents = ctx.quote.totalCents
    } catch (valueError) {
      // O Asaas não aceitou somar os extras: segue só o plano, sem cobrar o que não vai ser entregue.
      console.error('pix first payment value', valueError instanceof AsaasError ? valueError.body : String(valueError))
      await ctx.admin.from('store_orders').update({ status: 'failed', provider_payment_id: null, updated_at: new Date().toISOString() }).eq('id', order.id)
      bumpsFailed = true
    }
  }

  const qr = await getPixQrCode(pix.firstPaymentId)
  return json({ subscriptionId: ctx.subscriptionId, orderToken, totalCents, bumpsFailed, pix: qr }, 201)
}

async function pay(request: Request, admin: Admin, userId: string, body: PlanPayBody): Promise<Response> {
  const plan = await loadPlan(admin, body.plan)
  if (!plan) return errorResponse(404, 'plan_not_found', 'Plano não encontrado.')
  if ((await livePlanSlug(admin, userId)) === plan.slug) return errorResponse(409, 'already_subscribed', 'Você já está nesse plano.')

  let quote: PlanQuote
  try {
    quote = quotePlanOrder(plan.price_cents, await loadBumps(admin), body.bumps)
  } catch {
    return errorResponse(400, 'invalid_order', 'Essa oferta não está mais disponível. Recarregue a página.')
  }
  if (quote.totalCents !== body.expectedTotalCents) {
    return errorResponse(409, 'price_changed', 'O valor mudou desde que você abriu a página. Confira e tente de novo.')
  }
  if (await tooManyPending(admin, userId)) {
    return errorResponse(429, 'too_many_checkouts', 'Muitas tentativas abertas. Conclua uma ou tente mais tarde.')
  }
  const email = await accountEmail(admin, userId)
  if (!email) return errorResponse(400, 'missing_email', 'Sua conta está sem e-mail. Fale com o suporte.')

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

  const remoteIp = clientIp(request)
  try {
    const customerId = await findOrCreateCustomer({
      name: body.buyer.name,
      cpf: body.buyer.cpf,
      email,
      phone: body.buyer.phone,
      externalReference: userId,
    })
    const ctx: Context = {
      admin,
      userId,
      email,
      plan,
      quote,
      body,
      subscriptionId: subscription.id,
      customerId,
      remoteIp,
      ipHash: await sha256(remoteIp),
    }
    return body.method === 'card' ? await payWithCard(ctx, body.card) : await payWithPix(ctx)
  } catch (payError) {
    await setSubscription(admin, subscription.id, { status: 'expired', ended_at: new Date().toISOString() })
    if (payError instanceof CardDeclinedError) return errorResponse(402, 'card_declined', payError.message)
    // Só o corpo do Asaas vai para o log: ele não repete o cartão.
    console.error('subscription payment failed', body.method, payError instanceof AsaasError ? payError.body : String(payError))
    return errorResponse(502, 'payment_unavailable', 'O pagamento não abriu agora. Nada foi cobrado. Tente de novo em instantes.')
  }
}

async function status(admin: Admin, userId: string, id: string): Promise<Response> {
  const { data } = await admin.from('subscriptions').select('status').eq('id', id).eq('user_id', userId).maybeSingle<{ status: string }>()
  if (!data) return errorResponse(404, 'subscription_not_found', 'Assinatura não encontrada.')
  return json({ status: data.status })
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')
    const raw = await readJson(request)

    const offerBody = offerSchema.safeParse(raw)
    if (offerBody.success) return offer(admin, userId, offerBody.data.plan)
    const statusBody = statusSchema.safeParse(raw)
    if (statusBody.success) return status(admin, userId, statusBody.data.subscription)

    const parsed = planPayBodySchema.safeParse(raw)
    if (!parsed.success) return errorResponse(400, 'invalid_body', firstIssue(parsed.error))
    if (await isSuspended(admin, userId)) return errorResponse(403, 'account_suspended', 'Sua conta está suspensa. Fale com o suporte.')
    return pay(request, admin, userId, parsed.data)
  }),
)
