import { z } from 'zod'

// Fronteira com o banco: toda linha lida do Supabase passa por um destes schemas.

export const mediaKindSchema = z.enum(['image', 'video'])
export type MediaKind = z.infer<typeof mediaKindSchema>

export const modelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  kind: mediaKindSchema,
  requires_image: z.boolean(),
  credits: z.number().int(),
  position: z.number().int(),
  badge: z.enum(['NOVO', 'TOP']).nullable(),
  defaults: z.record(z.unknown()),
  /** Planos que podem usar o modelo; nulo libera para todos. */
  allowed_plans: z.array(z.string()).nullable(),
})
export type Model = z.infer<typeof modelSchema>

export const generationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed'])
export type GenerationStatus = z.infer<typeof generationStatusSchema>

export const generationSchema = z.object({
  id: z.string().uuid(),
  model_slug: z.string(),
  kind: mediaKindSchema,
  prompt: z.string(),
  persona_id: z.string().uuid().nullable(),
  source_generation_id: z.string().uuid().nullable(),
  /** Projeto do Workspace (0009). Linhas antigas do demo não têm o campo. */
  project_id: z.string().uuid().nullable().default(null),
  credits: z.number().int(),
  status: generationStatusSchema,
  output_path: z.string().nullable(),
  output_type: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
})
export type Generation = z.infer<typeof generationSchema>

export const personaSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  image_path: z.string(),
  created_at: z.string(),
})
export type Persona = z.infer<typeof personaSchema>

export const creditPackSchema = z.object({
  slug: z.string(),
  name: z.string(),
  credits: z.number().int(),
  price_cents: z.number().int(),
  highlight: z.boolean(),
})
export type CreditPack = z.infer<typeof creditPackSchema>

export const ledgerReasonSchema = z.enum([
  'signup_bonus',
  'purchase',
  'generation',
  'generation_refund',
  'adjustment',
  'subscription_grant',
  'subscription_expire',
])
export type LedgerReason = z.infer<typeof ledgerReasonSchema>

export const ledgerEntrySchema = z.object({
  id: z.number().int(),
  delta: z.number().int(),
  reason: ledgerReasonSchema,
  note: z.string().nullable(),
  balance_after: z.number().int().nullable(),
  created_at: z.string(),
})
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

/** Carteira em dois baldes: o do plano renova e não acumula; o comprado não expira. */
export const walletSchema = z.object({
  balance: z.number().int(),
  subscription_balance: z.number().int(),
  purchased_balance: z.number().int(),
})
export type Wallet = z.infer<typeof walletSchema>

export const planSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  price_cents: z.number().int(),
  monthly_credits: z.number().int(),
  max_concurrent: z.number().int(),
  max_personas: z.number().int(),
  max_brands: z.number().int(),
  /** Ferramentas do menu que o plano inclui (`PLAN_TOOLS`). Valor desconhecido é ignorado. */
  tools: z.array(z.string()),
  features: z.array(z.string()),
  public: z.boolean(),
  highlight: z.boolean(),
  position: z.number().int(),
})
export type Plan = z.infer<typeof planSchema>

export const PLAN_COLUMNS =
  'slug, name, description, price_cents, monthly_credits, max_concurrent, max_personas, max_brands, tools, features, public, highlight, position'

export const subscriptionStatusSchema = z.enum(['pending', 'active', 'past_due', 'canceled', 'expired'])
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  plan_slug: z.string(),
  status: subscriptionStatusSchema,
  price_cents: z.number().int(),
  monthly_credits: z.number().int(),
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  canceled_at: z.string().nullable(),
  created_at: z.string(),
})
export type Subscription = z.infer<typeof subscriptionSchema>

export const SUBSCRIPTION_COLUMNS =
  'id, plan_slug, status, price_cents, monthly_credits, current_period_start, current_period_end, canceled_at, created_at'

export const subscriptionPaymentSchema = z.object({
  id: z.string().uuid(),
  amount_cents: z.number().int(),
  status: z.enum(['confirmed', 'refunded']),
  invoice_url: z.string().nullable(),
  paid_at: z.string(),
})
export type SubscriptionPayment = z.infer<typeof subscriptionPaymentSchema>

export const goalSchema = z.enum(['influencers', 'viral_videos', 'ugc_ads', 'images', 'social_content', 'all_tools'])
export type Goal = z.infer<typeof goalSchema>

export const preferencesSchema = z.object({
  goal: goalSchema.nullable(),
  onboarded_at: z.string().nullable(),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const purchaseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'paid', 'expired', 'refunded']),
  credits: z.number().int(),
})
export type Purchase = z.infer<typeof purchaseSchema>

export const GENERATION_COLUMNS =
  'id, model_slug, kind, prompt, persona_id, source_generation_id, project_id, credits, status, output_path, output_type, error, created_at, completed_at'

/** Só foto e vídeo vão para a galeria e o Studio; texto é do assistente. */
export const MEDIA_KINDS: readonly MediaKind[] = ['image', 'video']

export function isOpen(generation: Pick<Generation, 'status'>): boolean {
  return generation.status === 'queued' || generation.status === 'running'
}

/** De onde sai a imagem que um modelo de foto-com-persona ou de vídeo anima. */
export type ImageSource = { readonly type: 'persona'; readonly id: string } | { readonly type: 'image'; readonly id: string }

export const profileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable(),
  username: z.string(),
  bio: z.string(),
  location: z.string(),
  instagram: z.string(),
  tiktok: z.string(),
  youtube: z.string(),
  avatar_path: z.string().nullable(),
  created_at: z.string(),
})
export type Profile = z.infer<typeof profileSchema>

export const PROFILE_COLUMNS = 'id, display_name, username, bio, location, instagram, tiktok, youtube, avatar_path, created_at'

/** @ de rede social: aceita com ou sem o @ na frente e guarda sem. */
const socialHandle = (pattern: RegExp, message: string) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim().replace(/^@/, '') : value), z.string().regex(pattern, message))

/** O que a pessoa pode editar no próprio perfil. Espelha as checks da migration 0002. */
export const profileUpdateSchema = z.object({
  display_name: z.string().trim().max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,24}$/, 'Use de 3 a 24 letras minúsculas, números, ponto ou _.'),
  bio: z.string().trim().max(300),
  location: z.string().trim().max(80),
  instagram: socialHandle(/^[A-Za-z0-9._]{0,30}$/, 'Só o @ do Instagram, sem link.'),
  tiktok: socialHandle(/^[A-Za-z0-9._]{0,30}$/, 'Só o @ do TikTok, sem link.'),
  youtube: socialHandle(/^[A-Za-z0-9._-]{0,60}$/, 'Só o @ do canal, sem link.'),
  avatar_path: z.string().nullable(),
})
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

// ------------------------------------------------------------- workspace (0009)

/** O contexto que a marca leva para as ferramentas de texto. Espelha as checks da 0009. */
export const brandInputSchema = z.object({
  name: z.string().trim().min(1, 'Dê um nome para a marca.').max(60),
  niche: z.string().trim().max(120),
  audience: z.string().trim().max(500),
  tone: z.string().trim().max(300),
  offer: z.string().trim().max(500),
  avoid: z.string().trim().max(300),
  visual_style: z.string().trim().max(300),
})
export type BrandInput = z.infer<typeof brandInputSchema>

export const brandSchema = brandInputSchema.extend({
  id: z.string().uuid(),
  created_at: z.string(),
})
export type Brand = z.infer<typeof brandSchema>

export const BRAND_COLUMNS = 'id, name, niche, audience, tone, offer, avoid, visual_style, created_at'

export const projectStatusSchema = z.enum(['planning', 'producing', 'done'])
export type ProjectStatus = z.infer<typeof projectStatusSchema>

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, 'Dê um nome para o projeto.').max(80),
  goal: z.string().trim().max(500),
  brand_id: z.string().uuid().nullable(),
  status: projectStatusSchema,
})
export type ProjectInput = z.infer<typeof projectInputSchema>

export const projectSchema = projectInputSchema.extend({
  id: z.string().uuid(),
  created_at: z.string(),
})
export type Project = z.infer<typeof projectSchema>

export const PROJECT_COLUMNS = 'id, name, goal, brand_id, status, created_at'

// ------------------------------------------------------------- assistente (0010)

/** Ferramentas de texto: cada uma é uma linha de `models` com kind = 'text'. */
export const assistantToolSchema = z.enum(['copy', 'roteiro', 'ideias', 'ugc-roteiro'])
export type AssistantTool = z.infer<typeof assistantToolSchema>

export const textModelSchema = z.object({
  slug: assistantToolSchema,
  name: z.string(),
  description: z.string(),
  credits: z.number().int(),
  badge: z.enum(['NOVO', 'TOP']).nullable(),
  allowed_plans: z.array(z.string()).nullable(),
})
export type TextModel = z.infer<typeof textModelSchema>

export const assistantOutputSchema = z.object({
  title: z.string(),
  items: z.array(z.object({ label: z.string(), text: z.string(), visual_prompt: z.string() })),
})
export type AssistantOutput = z.infer<typeof assistantOutputSchema>

/** `output_text` é JSON gravado pela function; texto ilegível vira nulo em vez de quebrar a tela. */
const outputTextSchema = z
  .string()
  .nullable()
  .transform((value) => {
    if (!value) return null
    try {
      const parsed = assistantOutputSchema.safeParse(JSON.parse(value))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  })

export const textGenerationSchema = z.object({
  id: z.string().uuid(),
  model_slug: assistantToolSchema,
  prompt: z.string(),
  brand_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  credits: z.number().int(),
  status: generationStatusSchema,
  output_text: outputTextSchema,
  error: z.string().nullable(),
  created_at: z.string(),
})
export type TextGeneration = z.infer<typeof textGenerationSchema>

export const TEXT_GENERATION_COLUMNS = 'id, model_slug, prompt, brand_id, project_id, credits, status, output_text, error, created_at'
