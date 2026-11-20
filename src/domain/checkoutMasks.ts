// Máscaras dos campos do checkout. Só formatam o que a pessoa vê; quem valida é a function.

const onlyDigits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

export function maskCpf(value: string): string {
  const digits = onlyDigits(value, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const local = digits.slice(2)
  const split = local.length > 8 ? 5 : 4
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? `-${local.slice(split)}` : ''}`
}

export function maskCep(value: string): string {
  const digits = onlyDigits(value, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function maskCardNumber(value: string): string {
  return onlyDigits(value, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** Validade no formato MM/AA. */
export function maskExpiry(value: string): string {
  const digits = onlyDigits(value, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'elo' | 'hipercard' | null

/** Bandeira pelo começo do número, só para mostrar o nome ao lado do campo. */
export function cardBrand(value: string): CardBrand {
  const digits = value.replace(/\D/g, '')
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(digits)) return 'elo'
  if (/^(606282|3841)/.test(digits)) return 'hipercard'
  if (/^3[47]/.test(digits)) return 'amex'
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard'
  return null
}

export const BRAND_LABEL: Record<Exclude<CardBrand, null>, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  elo: 'Elo',
  hipercard: 'Hipercard',
}
