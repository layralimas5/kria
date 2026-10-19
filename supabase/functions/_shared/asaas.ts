// Cliente mínimo do Asaas: checkout avulso de créditos (Pix e cartão) e
// checkout de assinatura mensal (cartão, recorrente), mesmo padrão do Momentumm.
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
      'User-Agent': 'Kria IA',
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
        name: `Kria IA ${input.packName}`.slice(0, 30),
        description: `${input.credits} créditos para gerar imagens e vídeos`.slice(0, 150),
        quantity: 1,
        value: input.priceCents / 100,
        imageBase64: PRODUCT_IMAGE_BASE64,
      },
    ],
  })
}

export interface SubscriptionCheckoutInput extends CheckoutUrls {
  readonly subscriptionId: string
  readonly planName: string
  readonly monthlyCredits: number
  readonly priceCents: number
}

/** Assinatura recorrente: o Asaas guarda o cartão e cobra todo mês a partir de hoje. */
export function createSubscriptionCheckout(input: SubscriptionCheckoutInput): Promise<AsaasCheckout> {
  return call<AsaasCheckout>('POST', '/checkouts', {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 60,
    externalReference: input.subscriptionId,
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.cancelUrl },
    items: [
      {
        name: `Kria IA ${input.planName}`.slice(0, 30),
        description: `Plano mensal com ${input.monthlyCredits} créditos`.slice(0, 150),
        quantity: 1,
        value: input.priceCents / 100,
        imageBase64: PRODUCT_IMAGE_BASE64,
      },
    ],
    subscription: { cycle: 'MONTHLY', nextDueDate: todayInBrazil() },
  })
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
