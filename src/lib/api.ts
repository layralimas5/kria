import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  generationSchema,
  personaSchema,
  preferencesSchema,
  PROFILE_COLUMNS,
  profileSchema,
  type Generation,
  type Goal,
  type Persona,
  type Preferences,
  type Profile,
  type ProfileUpdate,
} from '@/domain/types'
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
  /** Mesma chave = mesmo pedido: o servidor não cobra nem gera duas vezes. */
  readonly idempotencyKey: string
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

export async function startSubscription(plan: string): Promise<string> {
  const data = await invoke('subscribe', { plan })
  return z.object({ url: z.string().url() }).parse(data).url
}

export async function cancelSubscription(): Promise<void> {
  await invoke('cancel-subscription', {})
}

/** Os dados da conta em JSON, para a pessoa baixar (LGPD). */
export async function exportAccountData(): Promise<unknown> {
  return invoke('account', { action: 'export' })
}

export async function deleteAccount(): Promise<void> {
  await invoke('account', { action: 'delete', confirmation: 'EXCLUIR' })
  await supabase.auth.signOut({ scope: 'local' })
}

export async function fetchPreferences(userId: string): Promise<Preferences | null> {
  const { data, error } = await supabase.from('user_preferences').select('goal, onboarded_at').eq('user_id', userId).maybeSingle()
  if (error) throw new ApiError('preferences_unavailable', 'Não deu para carregar suas preferências.')
  return data ? preferencesSchema.parse(data) : null
}

export async function saveGoal(userId: string, goal: Goal): Promise<Preferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, goal, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('goal, onboarded_at')
    .single()
  if (error) throw new ApiError('preferences_failed', 'Não deu para salvar sua escolha. Tente de novo.')
  return preferencesSchema.parse(data)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/nova-senha` })
  if (error) throw new ApiError('reset_failed', 'Não deu para enviar o e-mail agora. Tente de novo em instantes.')
}

const PERSONA_ERRORS: Record<string, string> = {
  source_not_found: 'Essa imagem não pode virar persona.',
  too_many_personas: 'Você chegou ao limite de personagens do seu plano. Remova um ou veja os planos em Assinatura.',
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
