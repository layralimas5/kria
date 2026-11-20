// Cliente mínimo do Asaas: checkout avulso de créditos (Pix e cartão) e
// assinatura mensal no cartão (checkout recorrente) ou no Pix (API de assinaturas: o checkout
// do Asaas só aceita cartão em cobrança recorrente).
//   ASAAS_API_KEY   chave da conta (sandbox ou produção)
//   ASAAS_ENV       'sandbox' (padrão) ou 'production'

import { PRODUCT_IMAGE_BASE64 } from './product-image.ts'

const BASE_URLS = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
} as const

export class AsaasError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`Asaas respondeu ${status}`)
    this.name = 'AsaasError'
    this.status = status
    this.body = body
  }
}

export interface AsaasCheckout {
  readonly id: string
  readonly link: string
}

export interface AsaasSubscription {
  readonly id: string
  readonly customer: string
  readonly status: string
  readonly externalReference: string | null
}

function baseUrl(): string {
  return Deno.env.get('ASAAS_ENV') === 'production' ? BASE_URLS.production : BASE_URLS.sandbox
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: Deno.env.get('ASAAS_API_KEY') ?? '',
      'User-Agent': 'Vynkio',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  if (!response.ok) throw new AsaasError(response.status, parsed)
  return parsed as T
}

/** Hoje no fuso de Brasília, no formato que o Asaas espera (`YYYY-MM-DD`). */
export function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

interface CheckoutUrls {
  readonly successUrl: string
  readonly cancelUrl: string
}

export interface CreditCheckoutInput extends CheckoutUrls {
  readonly purchaseId: string
  readonly packName: string
  readonly credits: number
  readonly priceCents: number
}

export function createCreditCheckout(input: CreditCheckoutInput): Promise<AsaasCheckout> {
  return call<AsaasCheckout>('POST', '/checkouts', {
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['DETACHED'],
    minutesToExpire: 60,
    externalReference: input.purchaseId,
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.cancelUrl },
    items: [
      {
        name: `Vynkio ${input.packName}`.slice(0, 30),
        description: `${input.credits} créditos para gerar imagens e vídeos`.slice(0, 150),
        quantity: 1,
        value: input.priceCents / 100,
        imageBase64: PRODUCT_IMAGE_BASE64,
      },
    ],
  })
}

export interface StoreCheckoutInput extends CheckoutUrls {
  readonly orderId: string
  readonly productName: string
  readonly priceCents: number
}

/** Infoproduto da loja: pagamento único, Pix ou cartão. O Asaas pede nome, e-mail e CPF no checkout. */
export function createStoreCheckout(input: StoreCheckoutInput): Promise<AsaasCheckout> {
  return call<AsaasCheckout>('POST', '/checkouts', {
    billingTypes: ['PIX', 'CREDIT_CARD'],
    chargeTypes: ['DETACHED'],
    minutesToExpire: 60,
    externalReference: input.orderId,
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.cancelUrl },
    items: [
      {
        name: input.productName.slice(0, 30),
        description: `${input.productName}: acesso imediato depois do pagamento`.slice(0, 150),
        quantity: 1,
        value: input.priceCents / 100,
        imageBase64: PRODUCT_IMAGE_BASE64,
      },
    ],
  })
}

export interface AsaasCustomerContact {
  readonly name: string | null
  readonly email: string | null
}

export async function getCustomerContact(id: string): Promise<AsaasCustomerContact> {
  const customer = await call<{ name?: string | null; email?: string | null }>('GET', `/customers/${encodeURIComponent(id)}`)
  return { name: customer.name ?? null, email: customer.email ?? null }
}

export interface SubscriptionCheckoutInput extends CheckoutUrls {
  readonly subscriptionId: string
  readonly planName: string
  readonly monthlyCredits: number
  readonly priceCents: number
}

/** Assinatura no cartão, a partir de hoje: o Asaas guarda o cartão e cobra sozinho todo mês. */
export function createSubscriptionCheckout(input: SubscriptionCheckoutInput): Promise<AsaasCheckout> {
  return call<AsaasCheckout>('POST', '/checkouts', {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 60,
    externalReference: input.subscriptionId,
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.cancelUrl },
    items: [
      {
        name: `Vynkio ${input.planName}`.slice(0, 30),
        description: `Plano mensal com ${input.monthlyCredits} créditos`.slice(0, 150),
        quantity: 1,
        value: input.priceCents / 100,
        imageBase64: PRODUCT_IMAGE_BASE64,
      },
    ],
    subscription: { cycle: 'MONTHLY', nextDueDate: todayInBrazil() },
  })
}

export interface PixPayer {
  readonly name: string
  readonly cpf: string
  readonly email: string | null
  readonly userId: string
}

interface AsaasCustomer {
  readonly id: string
}

interface AsaasPayment {
  readonly id: string
  readonly invoiceUrl: string
}

/** Cliente do Asaas pelo CPF: reaproveita o que já existe para não duplicar cadastro a cada tentativa. */
async function findOrCreateCustomer(payer: PixPayer): Promise<string> {
  const found = await call<{ data: AsaasCustomer[] }>('GET', `/customers?cpfCnpj=${payer.cpf}&limit=1`)
  if (found.data[0]) return found.data[0].id
  const created = await call<AsaasCustomer>('POST', '/customers', {
    name: payer.name,
    cpfCnpj: payer.cpf,
    ...(payer.email ? { email: payer.email } : {}),
    externalReference: payer.userId,
  })
  return created.id
}

export interface PixSubscriptionInput {
  readonly subscriptionId: string
  readonly planName: string
  readonly monthlyCredits: number
  readonly priceCents: number
  readonly payer: PixPayer
}

export interface PixSubscription {
  readonly providerSubscriptionId: string
  readonly customerId: string
  readonly invoiceUrl: string
}

/**
 * Assinatura no Pix, a partir de hoje. O Asaas gera uma cobrança Pix por mês e avisa a pessoa por
 * e-mail; o webhook trata `PAYMENT_RECEIVED` como pago e `PAYMENT_OVERDUE` como atraso, igual ao cartão.
 * Devolve a fatura da primeira cobrança, onde fica o QR Code.
 */
export async function createPixSubscription(input: PixSubscriptionInput): Promise<PixSubscription> {
  const customerId = await findOrCreateCustomer(input.payer)
  const subscription = await call<{ id: string }>('POST', '/subscriptions', {
    customer: customerId,
    billingType: 'PIX',
    cycle: 'MONTHLY',
    value: input.priceCents / 100,
    nextDueDate: todayInBrazil(),
    description: `Vynkio ${input.planName}: plano mensal com ${input.monthlyCredits} créditos`.slice(0, 500),
    externalReference: input.subscriptionId,
  })
  try {
    const payments = await call<{ data: AsaasPayment[] }>('GET', `/subscriptions/${encodeURIComponent(subscription.id)}/payments`)
    const first = payments.data[0]
    if (!first?.invoiceUrl) throw new Error('assinatura Pix sem primeira cobrança')
    return { providerSubscriptionId: subscription.id, customerId, invoiceUrl: first.invoiceUrl }
  } catch (error) {
    await deleteSubscription(subscription.id).catch(() => undefined)
    throw error
  }
}

export function getSubscription(id: string): Promise<AsaasSubscription> {
  return call<AsaasSubscription>('GET', `/subscriptions/${encodeURIComponent(id)}`)
}

/** Cancela a cobrança recorrente. Já removida lá (404) conta como cancelada. */
export async function deleteSubscription(id: string): Promise<void> {
  try {
    await call<{ deleted: boolean }>('DELETE', `/subscriptions/${encodeURIComponent(id)}`)
  } catch (error) {
    if (error instanceof AsaasError && error.status === 404) return
    throw error
  }
}
