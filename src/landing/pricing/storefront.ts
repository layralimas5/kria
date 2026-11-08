import { z } from 'zod'
import { supabase } from '@/lib/supabase'

// Vitrine v2/v3: lê `storefront_plans` (0019), a mesma tabela de planos do checkout e do painel.
// Nenhum preço, crédito ou limite mora no front. Creator só aparece depois da virada; Business
// aparece por contato; rascunho de venda direta nunca. Só com `VITE_PRICING_V2=true`.

const num = z.coerce.number()

export const storefrontPlanSchema = z.object({
  slug: z.string(),
  line: z.enum(['creator', 'business']),
  name: z.string(),
  tagline: z.string().nullable(),
  /** Nulo = sob consulta. */
  price_cents: num.nullable(),
  /** Créditos IA por mês; nulo = personalizado. No Free vem das boas-vindas. */
  monthly_credits: num.nullable(),
  exports_month: num.nullable(),
  seats: num.nullable(),
  highlight: z.boolean(),
  features: z.array(z.string()),
  /** Ainda não existe no produto: aparece como "Em breve", sem data. */
  soon_features: z.array(z.string()),
  limits: z.array(z.string()),
  cta: z.enum(['signup', 'subscribe', 'contact']),
})
export type StorefrontPlan = z.infer<typeof storefrontPlanSchema>

export const storefrontSchema = z.object({
  welcome_credits: num,
  credit_scale: num,
  plans: z.array(storefrontPlanSchema),
})
export type Storefront = z.infer<typeof storefrontSchema>

export async function fetchStorefront(): Promise<Storefront> {
  const { data, error } = await supabase.rpc('storefront_plans')
  if (error) throw new Error(`storefront_plans: ${error.message}`)
  return storefrontSchema.parse(data)
}

/** O Free mostra as boas-vindas no lugar dos créditos do mês. */
export function withWelcome(storefront: Storefront): StorefrontPlan[] {
  return storefront.plans.map((plan) => (plan.slug === 'gratis' ? { ...plan, monthly_credits: storefront.welcome_credits } : plan))
}

/**
 * Boas-vindas da proposta v3 (`pricing_settings.next_welcome_credits` na 0019), para os textos fixos da
 * landing (hero, termos). Os cards leem o valor do banco; `storefront.test.ts` falha se os dois separarem.
 */
export const WELCOME_CREDITS_V3 = 100

export const CREDIT_NOTICE =
  'Cada ferramenta de IA consome uma quantidade de créditos conforme o modelo e as configurações escolhidas. O custo em créditos é informado antes de cada geração.'
