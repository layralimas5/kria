// POST { email, display_name, plan_slug, grant_days, credits, suspended, role, reason }
// Cria uma conta pelo admin: confere permissão e valores no banco com o JWT de quem pediu
// (`admin_check_new_user`, que exige segundo fator), manda o convite do Supabase Auth (a pessoa
// define a própria senha pelo link; nenhuma senha passa por aqui) e aplica plano de cortesia,
// créditos e status por `admin_setup_new_user`, de novo com o JWT de quem pediu. Nada é cobrado.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { adminClient, authenticatedUserId, errorResponse, handle, json, readJson, requireEnv } from '../_shared/http.ts'

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  display_name: z.string().trim().min(2).max(80),
  plan_slug: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable(),
  grant_days: z.number().int().min(1).max(365).nullable(),
  credits: z.number().int().min(0).max(100000),
  suspended: z.boolean(),
  role: z.enum(['super_admin', 'admin', 'support', 'finance', 'analyst']).nullable(),
  reason: z.string().trim().min(5).max(300),
})
type NewUser = z.infer<typeof bodySchema>

const CHECK_ERRORS: Record<string, string> = {
  forbidden: 'Você não tem permissão para criar contas.',
  mfa_required: 'Confirme o segundo fator para continuar.',
  email_taken: 'Já existe uma conta com esse e-mail.',
  invalid_email: 'E-mail inválido.',
  invalid_days: 'Escolha de 1 a 365 dias de cortesia.',
  plan_not_found: 'Plano não encontrado ou fora do ar.',
  invalid_amount: 'Créditos iniciais vão de 0 a 100.000.',
  reason_required: 'Escreva o motivo (pelo menos 5 caracteres).',
}

function userClient(request: Request): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: request.headers.get('authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function refusal(error: { message: string }): Response {
  const message = CHECK_ERRORS[error.message]
  return message ? errorResponse(400, error.message, message) : errorResponse(500, 'admin_failed', 'A operação não foi concluída.')
}

async function setup(asUser: SupabaseClient, userId: string, body: NewUser): Promise<string | null> {
  const plan = body.plan_slug === 'gratis' ? null : body.plan_slug
  const { error } = await asUser.rpc('admin_setup_new_user', {
    p_user_id: userId,
    p_plan_slug: plan,
    p_grant_days: plan ? body.grant_days : null,
    p_credits: body.credits,
    p_suspended: body.suspended,
    p_reason: body.reason,
  })
  if (error) return error.message
  if (!body.role) return null
  const { error: roleError } = await asUser.rpc('admin_set_role', { p_email: body.email, p_role: body.role, p_reason: body.reason })
  return roleError ? `role:${roleError.message}` : null
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const callerId = await authenticatedUserId(request, admin)
    if (!callerId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Confira nome, e-mail, plano e motivo.')
    const body = parsed.data
    const asUser = userClient(request)

    const { error: checkError } = await asUser.rpc('admin_check_new_user', {
      p_email: body.email,
      p_plan_slug: body.plan_slug,
      p_grant_days: body.grant_days,
      p_credits: body.credits,
      p_reason: body.reason,
    })
    if (checkError) return refusal(checkError)

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
      data: { display_name: body.display_name },
      redirectTo: `${requireEnv('APP_URL')}/nova-senha`,
    })
    if (inviteError || !invited.user) {
      console.error('admin-users invite', inviteError?.message)
      return errorResponse(502, 'invite_failed', 'O convite não saiu. Confira o e-mail e o SMTP do Auth e tente de novo.')
    }

    const setupError = await setup(asUser, invited.user.id, body)
    if (setupError) {
      // A conta existe e o convite saiu; o que faltou aparece para o admin ajustar pelo perfil.
      console.error('admin-users setup', invited.user.id, setupError)
      return json({ user_id: invited.user.id, partial: true, error: setupError }, 207)
    }
    return json({ user_id: invited.user.id, partial: false })
  }),
)
