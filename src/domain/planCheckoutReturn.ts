// Quem cria a conta no checkout de um plano confirma o e-mail e volta para o mesmo checkout.
// O link de confirmação leva na URL o que a pessoa já tinha escolhido (forma de pagamento e extras).

export type ReturnMethod = 'pix' | 'card'

export interface CheckoutChoices {
  readonly method: ReturnMethod
  readonly bumps: readonly string[]
}

const SLUG = /^[a-z0-9-]{2,60}$/
const MAX_BUMPS = 3

/** Caminho do checkout com as escolhas, para o `emailRedirectTo` do cadastro. */
export function checkoutReturnPath(plan: string, choices: CheckoutChoices): string {
  const params = new URLSearchParams({ metodo: choices.method })
  if (choices.bumps.length > 0) params.set('extras', choices.bumps.join(','))
  return `/assinar/${plan}?${params.toString()}`
}

/** Lê as escolhas da URL de volta; o que não for válido é ignorado (o servidor confere tudo de novo). */
export function readCheckoutChoices(search: string): CheckoutChoices | null {
  const params = new URLSearchParams(search)
  const method = params.get('metodo')
  if (method !== 'pix' && method !== 'card') return null
  const bumps = (params.get('extras') ?? '')
    .split(',')
    .filter((slug) => SLUG.test(slug))
    .slice(0, MAX_BUMPS)
  return { method, bumps }
}
