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

export interface CustomerInput {
  readonly name: string
  readonly cpf: string
  readonly email: string | null
  readonly phone?: string | null
  /** O nosso id de quem paga (usuário do app ou pedido da loja). */
  readonly externalReference: string
}

/** Cliente do Asaas pelo CPF: reaproveita o que já existe para não duplicar cadastro a cada tentativa. */
export async function findOrCreateCustomer(input: CustomerInput): Promise<string> {
  const found = await call<{ data: AsaasCustomer[] }>('GET', `/customers?cpfCnpj=${input.cpf}&limit=1`)
  if (found.data[0]) return found.data[0].id
  const created = await call<AsaasCustomer>('POST', '/customers', {
    name: input.name,
    cpfCnpj: input.cpf,
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { mobilePhone: input.phone } : {}),
    externalReference: input.externalReference,
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
  const { payer } = input
  const customerId = await findOrCreateCustomer({ name: payer.name, cpf: payer.cpf, email: payer.email, externalReference: payer.userId })
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

// Cobrança direta pela API: o checkout é a página do Vynkio, não a do Asaas (docs/loja.md).

export interface PixCharge {
  readonly paymentId: string
  readonly payload: string
  readonly qrBase64: string
  readonly expiresAt: string | null
}

export interface ChargeInput {
  readonly customerId: string
  readonly description: string
  /** O nosso id do pedido: volta em toda cobrança e no webhook. */
  readonly externalReference: string
}

/** Pix com vencimento hoje. Devolve o copia e cola e a imagem do QR para mostrar na própria página. */
export async function createPixCharge(input: ChargeInput & { readonly valueCents: number }): Promise<PixCharge> {
  const payment = await call<{ id: string }>('POST', '/payments', {
    customer: input.customerId,
    billingType: 'PIX',
    value: input.valueCents / 100,
    dueDate: todayInBrazil(),
    description: input.description.slice(0, 500),
    externalReference: input.externalReference,
  })
  const qr = await call<{ encodedImage: string; payload: string; expirationDate?: string | null }>(
    'GET',
    `/payments/${encodeURIComponent(payment.id)}/pixQrCode`,
  )
  return { paymentId: payment.id, payload: qr.payload, qrBase64: qr.encodedImage, expiresAt: qr.expirationDate ?? null }
}

export interface CardData {
  readonly holderName: string
  readonly number: string
  readonly expiryMonth: string
  readonly expiryYear: string
  readonly ccv: string
}

export interface CardHolder {
  readonly name: string
  readonly email: string
  readonly cpf: string
  readonly postalCode: string
  readonly addressNumber: string
  readonly phone: string
}

export interface CardChargeInput extends ChargeInput {
  readonly totalCents: number
  readonly installments: number
  readonly card: CardData
  readonly holder: CardHolder
  /** IP de quem está pagando (o Asaas usa na análise de risco). */
  readonly remoteIp: string
}

export interface CardCharge {
  readonly paymentId: string
  readonly installmentId: string | null
  readonly status: string
}

/** Cartão recusado pelo emissor ou pela análise do Asaas: a mensagem é a do Asaas, feita para quem paga. */
export class CardDeclinedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CardDeclinedError'
  }
}

/**
 * Cobra o cartão na hora. O número do cartão só passa por aqui a caminho do Asaas: não é gravado nem
 * aparece em log (o erro guarda só o corpo de resposta do Asaas, que não repete o cartão).
 */
export async function createCardCharge(input: CardChargeInput): Promise<CardCharge> {
  // Parcelado: `installmentCount` + `totalValue` (o centavo que sobrar vai na última); à vista: `value`.
  const installment =
    input.installments > 1 ? { installmentCount: input.installments, totalValue: input.totalCents / 100 } : { value: input.totalCents / 100 }
  try {
    const payment = await call<{ id: string; status: string; installment?: string | null }>('POST', '/payments', {
      customer: input.customerId,
      billingType: 'CREDIT_CARD',
      ...installment,
      dueDate: todayInBrazil(),
      description: input.description.slice(0, 500),
      externalReference: input.externalReference,
      creditCard: input.card,
      creditCardHolderInfo: {
        name: input.holder.name,
        email: input.holder.email,
        cpfCnpj: input.holder.cpf,
        postalCode: input.holder.postalCode,
        addressNumber: input.holder.addressNumber,
        phone: input.holder.phone,
        mobilePhone: input.holder.phone,
      },
      remoteIp: input.remoteIp,
    })
    return { paymentId: payment.id, installmentId: payment.installment ?? null, status: payment.status }
  } catch (error) {
    if (error instanceof AsaasError && error.status === 400) throw new CardDeclinedError(declineMessage(error.body))
    throw error
  }
}

const DEFAULT_DECLINE = 'O cartão não foi aprovado. Confira os dados ou tente outro cartão.'

export function declineMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('errors' in body) || !Array.isArray(body.errors)) return DEFAULT_DECLINE
  const first: unknown = body.errors[0]
  if (typeof first !== 'object' || first === null || !('description' in first)) return DEFAULT_DECLINE
  const description = first.description
  return typeof description === 'string' && description.length > 0 && description.length < 300 ? description : DEFAULT_DECLINE
}
