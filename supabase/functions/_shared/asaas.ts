// Cliente mínimo do Asaas: venda avulsa de créditos (checkout Pix e cartão)
// e assinatura mensal (checkout recorrente no cartão, mesmo padrão do Momentumm).
//   ASAAS_API_KEY   chave da conta (sandbox ou produção)
//   ASAAS_ENV       'sandbox' (padrão) ou 'production'
// Nenhum dado de cartão passa por aqui: o checkout do Asaas coleta e guarda.

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

/** Hoje, no fuso de Brasília, como o Asaas espera (`YYYY-MM-DD`). */
export function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

// ------------------------------------------------------- créditos avulsos

export interface CreditCheckoutInput {
  readonly purchaseId: string
  readonly packName: string
  readonly credits: number
  readonly priceCents: number
  readonly successUrl: string
  readonly cancelUrl: string
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

// ------------------------------------------------------------- assinatura

export interface SubscriptionCheckoutInput {
  readonly subscriptionId: string
  readonly planName: string
  readonly monthlyCredits: number
  readonly priceCents: number
  readonly successUrl: string
  readonly cancelUrl: string
}

/** Checkout recorrente: ao pagar, o Asaas cria a assinatura mensal e cobra o cartão todo mês. */
export function createSubscriptionCheckout(input: SubscriptionCheckoutInput): Promise<AsaasCheckout> {
  return call<AsaasCheckout>('POST', '/checkouts', {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: 60,
    externalReference: input.subscriptionId,
    callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.cancelUrl },
    items: [
      {
        name: input.planName.slice(0, 30),
        description: `${input.monthlyCredits} créditos por mês no Vynkio`.slice(0, 150),
        quantity: 1,
        value: input.priceCents / 100,
        imageBase64: PRODUCT_IMAGE_BASE64,
      },
    ],
    subscription: { cycle: 'MONTHLY', nextDueDate: todayInBrazil() },
  })
}

/** Troca de plano: o novo valor vale a partir da próxima cobrança. */
export function updateSubscriptionValue(providerSubscriptionId: string, priceCents: number, description: string): Promise<unknown> {
  return call('POST', `/subscriptions/${encodeURIComponent(providerSubscriptionId)}`, {
    value: priceCents / 100,
    description: description.slice(0, 200),
    updatePendingPayments: true,
  })
}

/** Encerra a cobrança recorrente. Nada já pago é estornado. */
export async function cancelProviderSubscription(providerSubscriptionId: string): Promise<void> {
  await call<{ deleted: boolean }>('DELETE', `/subscriptions/${encodeURIComponent(providerSubscriptionId)}`)
}
