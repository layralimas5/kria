import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  analyticsImportSchema,
  IMPORT_COLUMNS,
  SNAPSHOT_COLUMNS,
  snapshotSchema,
  type AnalyticsImport,
  type AnalyticsPlatform,
  type AnalyticsRow,
  type Snapshot,
} from '@/domain/analytics'
import type { Channel, ContentGoal, CopyFormat, TextLength } from '@/domain/assistant'
import {
  CONTENT_COLUMNS,
  contentItemSchema,
  type ContentInput,
  type ContentItem,
  type NewContent,
} from '@/domain/content'
import {
  BRAND_COLUMNS,
  brandSchema,
  generationSchema,
  personaSchema,
  preferencesSchema,
  PROFILE_COLUMNS,
  profileSchema,
  PROJECT_COLUMNS,
  projectSchema,
  textGenerationSchema,
  type AssistantTool,
  type Brand,
  type BrandInput,
  type Generation,
  type Goal,
  type Persona,
  type Preferences,
  type Profile,
  type ProfileUpdate,
  type Project,
  type ProjectInput,
  type TextGeneration,
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
  /** Escolhas entre as opções do modelo; o servidor recusa valor fora do catálogo. */
  readonly options?: Readonly<Record<string, string>>
  readonly personaId?: string
  readonly sourceGenerationId?: string
  readonly brandId?: string
  readonly projectId?: string
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

const PREFERENCES_COLUMNS = 'goal, onboarded_at, active_brand_id'

export async function fetchPreferences(userId: string): Promise<Preferences | null> {
  const { data, error } = await supabase.from('user_preferences').select(PREFERENCES_COLUMNS).eq('user_id', userId).maybeSingle()
  if (error) throw new ApiError('preferences_unavailable', 'Não deu para carregar suas preferências.')
  return data ? preferencesSchema.parse(data) : null
}

export async function saveGoal(userId: string, goal: Goal): Promise<Preferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, goal, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select(PREFERENCES_COLUMNS)
    .single()
  if (error) throw new ApiError('preferences_failed', 'Não deu para salvar sua escolha. Tente de novo.')
  return preferencesSchema.parse(data)
}

/** A marca que passa a valer no assistente, no Studio e nos conteúdos. O banco recusa marca de outra pessoa. */
export async function saveActiveBrand(userId: string, brandId: string | null): Promise<Preferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, active_brand_id: brandId }, { onConflict: 'user_id' })
    .select(PREFERENCES_COLUMNS)
    .single()
  if (error) throw new ApiError(error.message, error.message === 'brand_not_found' ? 'Essa marca não existe mais.' : 'Não deu para trocar a marca.')
  return preferencesSchema.parse(data)
}

/** Manda por e-mail o código de recuperação (template `recovery` mostra o `{{ .Token }}`). */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (!error) return
  if (error.status === 429) throw new ApiError('reset_rate_limited', 'Muitos pedidos seguidos. Espere um minuto e peça de novo.')
  throw new ApiError('reset_failed', 'Não deu para enviar o e-mail agora. Tente de novo em instantes.')
}

/** Confere o código do e-mail. Se bater, o Supabase abre a sessão e a pessoa já pode trocar a senha. */
export async function verifyResetCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
  if (!error) return
  if (error.status === 429) throw new ApiError('code_rate_limited', 'Muitas tentativas. Espere um minuto e tente de novo.')
  throw new ApiError('code_invalid', 'Código errado ou vencido. Confira o e-mail ou peça um novo.')
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

/** Liga o personagem a uma marca (ou solta, com `null`). O banco recusa marca de outra pessoa. */
export async function linkPersonaBrand(id: string, brandId: string | null): Promise<void> {
  const { error } = await supabase.from('personas').update({ brand_id: brandId }).eq('id', id)
  if (error) throw new ApiError(error.message, error.message === 'brand_not_found' ? 'Essa marca não existe mais.' : 'Não deu para ligar o personagem à marca.')
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

// ------------------------------------------------------------------ workspace

const WORKSPACE_ERRORS: Record<string, string> = {
  too_many_brands: 'Você chegou ao limite de marcas do seu plano. Remova uma ou veja os planos em Assinatura.',
  too_many_projects: 'Você chegou ao limite de projetos.',
  plan_required: 'Projetos fazem parte do plano Studio. Veja os planos em Assinatura.',
  brand_not_found: 'Essa marca não existe mais. Escolha outra.',
}

function workspaceError(error: { message: string }, fallback: string): ApiError {
  return new ApiError(error.message, WORKSPACE_ERRORS[error.message] ?? fallback)
}

export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select(BRAND_COLUMNS).order('created_at', { ascending: false })
  if (error) throw new ApiError('brands_unavailable', 'Não deu para carregar suas marcas.')
  return z.array(brandSchema).parse(data)
}

export async function saveBrand(input: BrandInput, id?: string): Promise<Brand> {
  const query = id ? supabase.from('brands').update(input).eq('id', id) : supabase.from('brands').insert(input)
  const { data, error } = await query.select(BRAND_COLUMNS).single()
  if (error) throw workspaceError(error, 'Não deu para salvar a marca. Confira os campos.')
  return brandSchema.parse(data)
}

export async function deleteBrand(id: string): Promise<void> {
  const { error } = await supabase.from('brands').delete().eq('id', id)
  if (error) throw new ApiError('delete_failed', 'Não deu para remover a marca.')
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select(PROJECT_COLUMNS).order('created_at', { ascending: false })
  if (error) throw new ApiError('projects_unavailable', 'Não deu para carregar seus projetos.')
  return z.array(projectSchema).parse(data)
}

export async function saveProject(input: ProjectInput, id?: string): Promise<Project> {
  const query = id ? supabase.from('projects').update(input).eq('id', id) : supabase.from('projects').insert(input)
  const { data, error } = await query.select(PROJECT_COLUMNS).single()
  if (error) throw workspaceError(error, 'Não deu para salvar o projeto. Confira os campos.')
  return projectSchema.parse(data)
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw new ApiError('delete_failed', 'Não deu para remover o projeto.')
}

// ----------------------------------------------------------------- assistente

export interface AssistantInput {
  readonly tool: AssistantTool
  readonly brief: string
  readonly channel: Channel
  readonly format?: CopyFormat
  readonly goal?: ContentGoal
  readonly length?: TextLength
  readonly tone?: string
  readonly brandId?: string
  readonly projectId?: string
  readonly idempotencyKey: string
}

/** Pede o texto e espera: a function só responde quando o Claude termina (10 a 40 s). */
export async function runAssistant(input: AssistantInput): Promise<TextGeneration> {
  const data = await invoke('assistant', { ...input })
  return z.object({ generation: textGenerationSchema }).parse(data).generation
}

// ------------------------------------------------------------------ conteúdos

const CONTENT_ERRORS: Record<string, string> = {
  too_many_contents: 'Você chegou ao limite de conteúdos. Apague os antigos que não usa mais.',
  brand_not_found: 'Essa marca não existe mais. Escolha outra.',
  project_not_found: 'Esse projeto não existe mais. Escolha outro.',
  asset_not_found: 'Uma das imagens ou vídeos não está pronta ou foi removida.',
  source_not_found: 'O texto de origem não foi encontrado.',
}

function contentError(error: { message: string }, fallback: string): ApiError {
  return new ApiError(error.message, CONTENT_ERRORS[error.message] ?? fallback)
}

export async function fetchContentItems(): Promise<ContentItem[]> {
  const { data, error } = await supabase.from('content_items').select(CONTENT_COLUMNS).order('updated_at', { ascending: false })
  if (error) throw new ApiError('contents_unavailable', 'Não deu para carregar seus conteúdos.')
  return z.array(contentItemSchema).parse(data)
}

export async function createContentItem(input: NewContent): Promise<ContentItem> {
  const { data, error } = await supabase.from('content_items').insert(input).select(CONTENT_COLUMNS).single()
  if (error) throw contentError(error, 'Não deu para salvar o conteúdo. Confira os campos.')
  return contentItemSchema.parse(data)
}

export async function updateContentItem(id: string, changes: Partial<ContentInput>): Promise<ContentItem> {
  const { data, error } = await supabase.from('content_items').update(changes).eq('id', id).select(CONTENT_COLUMNS).single()
  if (error) throw contentError(error, 'Não deu para salvar o conteúdo. Confira os campos.')
  return contentItemSchema.parse(data)
}

export async function deleteContentItem(id: string): Promise<void> {
  const { error } = await supabase.from('content_items').delete().eq('id', id)
  if (error) throw new ApiError('delete_failed', 'Não deu para remover o conteúdo.')
}

// ----------------------------------------------------------------- resultados

const ANALYTICS_ERRORS: Record<string, string> = {
  brand_not_found: 'Essa marca não existe mais. Escolha outra.',
  too_many_imports: 'Muitas importações seguidas. Espere um pouco e tente de novo.',
  invalid_rows: 'O arquivo não tem linhas válidas.',
}

export async function fetchSnapshots(): Promise<Snapshot[]> {
  const { data, error } = await supabase.from('analytics_snapshots').select(SNAPSHOT_COLUMNS).order('metric_date').limit(20000)
  if (error) throw new ApiError('analytics_unavailable', 'Não deu para carregar suas métricas.')
  return z.array(snapshotSchema).parse(data)
}

export async function fetchImports(): Promise<AnalyticsImport[]> {
  const { data, error } = await supabase.from('analytics_imports').select(IMPORT_COLUMNS).order('created_at', { ascending: false })
  if (error) throw new ApiError('imports_unavailable', 'Não deu para carregar suas importações.')
  return z.array(analyticsImportSchema).parse(data)
}

/** Grava o arquivo inteiro ou nada; o banco valida de novo cada linha. */
export async function importAnalytics(platform: AnalyticsPlatform, brandId: string | null, fileName: string, rows: readonly AnalyticsRow[]): Promise<void> {
  const { error } = await supabase.rpc('import_analytics', { p_platform: platform, p_brand_id: brandId, p_file_name: fileName, p_rows: rows })
  if (error) throw new ApiError(error.message, ANALYTICS_ERRORS[error.message] ?? 'O banco recusou o arquivo. Confira datas e números e tente de novo.')
}

export async function deleteImport(id: string): Promise<void> {
  const { error } = await supabase.from('analytics_imports').delete().eq('id', id)
  if (error) throw new ApiError('delete_failed', 'Não deu para remover a importação.')
}
