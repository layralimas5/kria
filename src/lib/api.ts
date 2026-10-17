import { FunctionsHttpError } from '@supabase/supabase-js'
import { z } from 'zod'
import { generationSchema, personaSchema, type Generation, type Persona } from '@/domain/types'
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
  too_many_personas: 'Você chegou ao limite de 30 personas.',
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
