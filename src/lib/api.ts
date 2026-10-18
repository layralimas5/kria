import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  generationSchema,
  personaSchema,
  PROFILE_COLUMNS,
  profileSchema,
  type Generation,
  type Persona,
  type Profile,
  type ProfileUpdate,
} from '@/domain/types'
import {
  PLAN_COLUMNS,
  SUBSCRIPTION_COLUMNS,
  subscriptionPlanSchema,
  subscriptionSchema,
  type Subscription,
  type SubscriptionPlan,
} from '@/domain/plans'
import { supabase } from './supabase'

export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

const errorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

async function invoke(name: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data
  if (error instanceof FunctionsHttpError) {
    const parsed = errorBodySchema.safeParse(await (error.context as Response).json().catch(() => null))
    if (parsed.success) throw new ApiError(parsed.data.error.code, parsed.data.error.message)
  }
  throw new ApiError('network', 'Sem conexão com o servidor. Tente de novo.')
}

export interface GenerateInput {
  readonly model: string
  readonly prompt: string
  readonly personaId?: string
  readonly sourceGenerationId?: string
}

export async function generate(input: GenerateInput): Promise<Generation> {
  const data = await invoke('generate', { ...input })
  return z.object({ generation: generationSchema }).parse(data).generation
}

export async function refreshGenerations(ids: readonly string[]): Promise<void> {
  if (ids.length > 0) await invoke('generation-status', { ids: ids.slice(0, 10) })
}

export async function startCheckout(pack: string): Promise<string> {
  const data = await invoke('buy-credits', { pack })
  return z.object({ url: z.string().url() }).parse(data).url
}

const PERSONA_ERRORS: Record<string, string> = {
  source_not_found: 'Essa imagem não pode virar persona.',
  too_many_personas: 'Você chegou ao limite de personagens do seu plano. Troque de plano para salvar mais.',
}

export async function createPersona(generationId: string, name: string, description: string): Promise<Persona> {
  const { data, error } = await supabase
    .rpc('create_persona', { p_generation_id: generationId, p_name: name, p_description: description })
    .single()
  if (error) throw new ApiError(error.message, PERSONA_ERRORS[error.message] ?? 'Não deu para salvar a persona.')
  return personaSchema.parse(data)
}

export async function deletePersona(id: string): Promise<void> {
  const { error } = await supabase.from('personas').delete().eq('id', id)
  if (error) throw new ApiError('delete_failed', 'Não deu para remover a persona.')
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Algo deu errado. Tente de novo.'
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single()
  if (error) throw new ApiError('profile_unavailable', 'Não deu para carregar seu perfil.')
  return profileSchema.parse(data)
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(update).eq('id', userId).select(PROFILE_COLUMNS).single()
  if (error) {
    if (error.code === '23505') throw new ApiError('username_taken', 'Esse @ já está em uso. Tente outro.')
    throw new ApiError('profile_update_failed', 'Não deu para salvar o perfil. Confira os campos.')
  }
  return profileSchema.parse(data)
}

export interface AccountStats {
  readonly personas: number
  readonly images: number
  readonly videos: number
  /** Soma de tudo que já entrou (boas-vindas, compras, estornos): base da barra de créditos. */
  readonly creditsReceived: number
}

async function countRows(table: 'personas' | 'generations', kind?: 'image' | 'video'): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (kind) query = query.eq('kind', kind).eq('status', 'succeeded')
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function fetchAccountStats(): Promise<AccountStats> {
  const [personas, images, videos, received] = await Promise.all([
    countRows('personas'),
    countRows('generations', 'image'),
    countRows('generations', 'video'),
    supabase.from('credit_ledger').select('delta').gt('delta', 0),
  ])
  if (received.error) throw received.error
  const creditsReceived = (received.data ?? []).reduce((total, row) => total + Number(row.delta), 0)
  return { personas, images, videos, creditsReceived }
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new ApiError('password_failed', 'Não deu para trocar a senha. Use pelo menos 8 caracteres.')
}

export async function signOutEverywhere(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) throw new ApiError('signout_failed', 'Não deu para sair dos outros aparelhos.')
}

// ------------------------------------------------------------ assinatura

export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase.from('subscription_plans').select(PLAN_COLUMNS).order('position')
  if (error) throw new ApiError('plans_failed', 'Não deu para carregar os planos.')
  return z.array(subscriptionPlanSchema).parse(data)
}

/** A assinatura mais recente da pessoa (qualquer status), ou `null`. */
export async function fetchSubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new ApiError('subscription_failed', 'Não deu para carregar sua assinatura.')
  return data ? subscriptionSchema.parse(data) : null
}

export type SubscribeResult = { readonly kind: 'checkout'; readonly url: string } | { readonly kind: 'changed' }

export async function startSubscription(plan: string): Promise<SubscribeResult> {
  const data = await invoke('subscribe', { plan })
  const parsed = z.union([z.object({ url: z.string().url() }), z.object({ changed: z.literal(true) })]).parse(data)
  return 'url' in parsed ? { kind: 'checkout', url: parsed.url } : { kind: 'changed' }
}

export async function cancelSubscription(): Promise<void> {
  await invoke('cancel-subscription', {})
}
