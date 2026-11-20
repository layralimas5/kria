// Regras puras do checkout próprio da loja (docs/loja.md): o que o navegador pode mandar e quanto o
// pedido custa. Sem rede, sem banco. Testado em storeCheckout.test.ts. O front importa o mesmo arquivo
// para mostrar os valores; a function recalcula tudo e recusa se o total que a pessoa viu não bater.

import { z } from 'npm:zod@3'
import { isValidCpf } from './billing.ts'
import { installmentOption } from './installments.ts'

const SLUG = z.string().regex(/^[a-z0-9-]{2,40}$/)
const digits = (value: string) => value.replace(/\D/g, '')

/** Número de cartão com o dígito verificador certo (Luhn). Recebe só os números. */
export function isValidCardNumber(number: string): boolean {
  if (!/^\d{13,19}$/.test(number)) return false
  let sum = 0
  for (let index = 0; index < number.length; index += 1) {
    let digit = Number(number[number.length - 1 - index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

const buyerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(5, 'Informe o nome completo.')
    .max(100)
    .refine((name) => name.split(/\s+/).length >= 2, 'Informe nome e sobrenome.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(120),
  cpf: z.string().transform(digits).refine(isValidCpf, 'CPF inválido. Confira os números.'),
  phone: z
    .string()
    .transform(digits)
    .refine((phone) => /^[1-9]{2}9?\d{8}$/.test(phone), 'Celular inválido. Use DDD e número.'),
})

/** Ano com 2 ou 4 dígitos vira 4; cartão vencido não passa. */
function expiryIsValid(month: string, year: string, now: Date): boolean {
  const monthNumber = Number(month)
  const yearNumber = Number(year)
  if (monthNumber < 1 || monthNumber > 12) return false
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1
  return yearNumber * 12 + monthNumber >= current && yearNumber <= now.getUTCFullYear() + 20
}

const cardSchema = z
  .object({
    holderName: z.string().trim().min(3, 'Informe o nome impresso no cartão.').max(80),
    number: z.string().transform(digits).refine(isValidCardNumber, 'Número do cartão inválido.'),
    expiryMonth: z.string().transform(digits).pipe(z.string().regex(/^\d{1,2}$/)).transform((month) => month.padStart(2, '0')),
    expiryYear: z
      .string()
      .transform(digits)
      .pipe(z.string().regex(/^(\d{2}|\d{4})$/))
      .transform((year) => (year.length === 2 ? `20${year}` : year)),
    ccv: z.string().transform(digits).pipe(z.string().regex(/^\d{3,4}$/, 'Código de segurança inválido.')),
    postalCode: z.string().transform(digits).pipe(z.string().regex(/^\d{8}$/, 'CEP inválido.')),
    addressNumber: z.string().trim().min(1, 'Informe o número do endereço.').max(10),
    installments: z.number().int().min(1).max(12),
  })
  .refine((card) => expiryIsValid(card.expiryMonth, card.expiryYear, new Date()), {
    message: 'Validade do cartão inválida.',
    path: ['expiryMonth'],
  })

export const payBodySchema = z.discriminatedUnion('method', [
  z.object({
    action: z.literal('pay'),
    method: z.literal('pix'),
    product: SLUG,
    bumps: z.array(SLUG).max(3).default([]),
    buyer: buyerSchema,
    expectedTotalCents: z.number().int().positive(),
  }),
  z.object({
    action: z.literal('pay'),
    method: z.literal('card'),
    product: SLUG,
    bumps: z.array(SLUG).max(3).default([]),
    buyer: buyerSchema,
    card: cardSchema,
    expectedTotalCents: z.number().int().positive(),
  }),
])

export type PayBody = z.infer<typeof payBodySchema>

/** Primeira mensagem de validação, para mostrar no formulário. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message && error.issues[0].message !== 'Invalid input' ? error.issues[0].message : 'Confira os dados do pagamento.'
}

export interface StoreProduct {
  readonly slug: string
  readonly name: string
  readonly price_cents: number
  readonly max_installments: number
  readonly interest_monthly: number
  readonly bump_slugs: readonly string[]
  readonly bump_price_cents: number | null
}

export interface OrderLine {
  readonly slug: string
  readonly name: string
  readonly priceCents: number
  readonly isBump: boolean
}

export interface OrderQuote {
  readonly lines: readonly OrderLine[]
  readonly subtotalCents: number
  readonly installments: number
  readonly installmentCents: number
  readonly totalCents: number
}

/** Preço de um produto quando ele entra como "leve junto". */
export function bumpPrice(product: Pick<StoreProduct, 'price_cents' | 'bump_price_cents'>): number {
  return product.bump_price_cents ?? product.price_cents
}

/**
 * Quanto o pedido custa. Só entram "leve junto" que o produto principal oferece; Pix é sempre à vista.
 * Parcelas acima do que o produto permite são recusadas.
 */
export function quoteOrder(
  main: StoreProduct,
  offeredBumps: readonly StoreProduct[],
  chosenBumps: readonly string[],
  installments: number,
): OrderQuote {
  if (installments > main.max_installments) throw new Error('installments_not_allowed')
  const chosen = new Set(chosenBumps)
  const lines: OrderLine[] = [{ slug: main.slug, name: main.name, priceCents: main.price_cents, isBump: false }]
  for (const slug of main.bump_slugs) {
    if (!chosen.has(slug) || slug === main.slug) continue
    const bump = offeredBumps.find((product) => product.slug === slug)
    if (bump) lines.push({ slug, name: bump.name, priceCents: bumpPrice(bump), isBump: true })
  }
  if (chosenBumps.some((slug) => !lines.some((line) => line.slug === slug))) throw new Error('bump_not_offered')

  const subtotalCents = lines.reduce((total, line) => total + line.priceCents, 0)
  const option = installmentOption(subtotalCents, installments, main.interest_monthly)
  return { lines, subtotalCents, installments, installmentCents: option.installmentCents, totalCents: option.totalCents }
}
