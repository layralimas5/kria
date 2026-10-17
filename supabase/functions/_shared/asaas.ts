// Cliente mínimo do Asaas para venda avulsa de créditos (checkout com Pix e cartão).
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

export interface CreditCheckoutInput {
  readonly purchaseId: string
  readonly packName: string
  readonly credits: number
  readonly priceCents: number
  readonly successUrl: string
  readonly cancelUrl: string
}

export interface AsaasCheckout {
  readonly id: string
  readonly link: string
}

function baseUrl(): string {
  return Deno.env.get('ASAAS_ENV') === 'production' ? BASE_URLS.production : BASE_URLS.sandbox
}

export async function createCreditCheckout(input: CreditCheckoutInput): Promise<AsaasCheckout> {
  const response = await fetch(`${baseUrl()}/checkouts`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      access_token: Deno.env.get('ASAAS_API_KEY') ?? '',
      'User-Agent': 'Kria',
    },
    body: JSON.stringify({
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      minutesToExpire: 60,
      externalReference: input.purchaseId,
      callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.cancelUrl },
      items: [
        {
          name: `Kria ${input.packName}`.slice(0, 30),
          description: `${input.credits} créditos para gerar imagens e vídeos`.slice(0, 150),
          quantity: 1,
          value: input.priceCents / 100,
          imageBase64: PRODUCT_IMAGE_BASE64,
        },
      ],
    }),
  })
  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  if (!response.ok) throw new AsaasError(response.status, parsed)
  return parsed as AsaasCheckout
}
