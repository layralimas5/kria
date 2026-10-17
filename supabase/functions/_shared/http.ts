import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

export function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status)
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Segredo ${name} não configurado`)
  return value
}

export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** O usuário do JWT enviado pelo app, ou `null` se faltar ou não valer. */
export async function authenticatedUserId(request: Request, admin: SupabaseClient): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Erros levantados pelas funções SQL (`raise exception 'codigo'`) viram resposta útil. */
const DATABASE_ERRORS: Record<string, { status: number; message: string }> = {
  model_unavailable: { status: 400, message: 'Esse modelo não está disponível.' },
  invalid_prompt: { status: 400, message: 'Descreva o que você quer com 3 a 2000 caracteres.' },
  one_image_only: { status: 400, message: 'Escolha uma persona ou uma imagem, não as duas.' },
  image_required: { status: 400, message: 'Esse modelo precisa de uma persona ou imagem de origem.' },
  model_takes_no_image: { status: 400, message: 'Esse modelo não usa imagem de origem.' },
  persona_not_found: { status: 404, message: 'Persona não encontrada.' },
  source_not_found: { status: 404, message: 'Imagem de origem não encontrada.' },
  account_not_found: { status: 404, message: 'Conta não encontrada.' },
  too_many_running: { status: 429, message: 'Você já tem 3 gerações em andamento. Espere uma terminar.' },
  insufficient_credits: { status: 402, message: 'Créditos insuficientes.' },
}

export function databaseErrorResponse(error: { message: string }): Response {
  const known = DATABASE_ERRORS[error.message]
  if (known) return errorResponse(known.status, error.message, known.message)
  console.error('database error', error)
  return errorResponse(500, 'internal', 'Algo deu errado do nosso lado. Tente de novo.')
}

export function handle(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method !== 'POST') return errorResponse(405, 'method_not_allowed', 'Use POST.')
    try {
      return await handler(request)
    } catch (error) {
      console.error('unhandled', error)
      return errorResponse(500, 'internal', 'Algo deu errado do nosso lado. Tente de novo.')
    }
  }
}
