// Ações do admin sobre contas, sempre conferidas no banco com o JWT de quem pediu (segundo fator,
// permissão e motivo) antes de usar a chave de serviço do Auth:
//
// POST { email, display_name, plan_slug, grant_days, credits, suspended, role, reason }
//   Cria uma conta pelo convite do Supabase Auth (`admin_check_new_user` + `admin_setup_new_user`).
//   A pessoa define a própria senha pelo link; nenhuma senha passa por aqui.
// POST { action: 'delete', user_id, reason, confirm_email }
//   Exclui a conta como a própria pessoa faria: cancela no Asaas, apaga arquivos e o usuário.
// POST { action: 'password', user_id, reason, password }
//   Define uma senha nova. A senha não vai para o banco nem para a auditoria.
// POST { action: 'reset_link', user_id, reason }
//   Manda o e-mail de recuperação com o código, o mesmo do "Esqueci minha senha".
// POST { action: 'view', user_id }
//   "Ver como usuário": o Dashboard da pessoa (`admin_user_view`, auditado) com links assinados das
//   mídias por 10 minutos. Só leitura; a sessão dela não é aberta.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { deleteAccountData, PaymentCancelError } from '../_shared/accountDeletion.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, json, readJson, requireEnv } from '../_shared/http.ts'

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  display_name: z.string().trim().min(2).max(80),
  plan_slug: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable(),
  grant_days: z.number().int().min(1).max(365).nullable(),
  credits: z.number().int().min(0).max(100000),
  suspended: z.boolean(),
  role: z.enum(['super_admin', 'admin', 'support', 'finance', 'analyst']).nullable(),
  reason: z.string().trim().min(5).max(300),
})
type NewUser = z.infer<typeof createSchema>

const userId = z.string().uuid()
const reason = z.string().trim().min(5).max(300)
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), user_id: userId, reason, confirm_email: z.string().trim().toLowerCase().max(254) }),
  // Mesmo limite da tela de cadastro (8) e o teto do Auth (72 bytes no bcrypt).
  z.object({ action: z.literal('password'), user_id: userId, reason, password: z.string().min(8).max(72) }),
  z.object({ action: z.literal('reset_link'), user_id: userId, reason }),
  z.object({ action: z.literal('view'), user_id: userId }),
])
type Action = z.infer<typeof actionSchema>

const CHECK_ERRORS: Record<string, string> = {
  forbidden: 'Você não tem permissão para isso.',
  mfa_required: 'Confirme o segundo fator para continuar.',
  email_taken: 'Já existe uma conta com esse e-mail.',
  invalid_email: 'E-mail inválido.',
  invalid_days: 'Escolha de 1 a 365 dias de cortesia.',
  plan_not_found: 'Plano não encontrado ou fora do ar.',
  invalid_amount: 'Créditos iniciais vão de 0 a 100.000.',
  reason_required: 'Escreva o motivo (pelo menos 5 caracteres).',
  cannot_change_self: 'Use a sua própria conta para mudar a sua senha ou excluí-la.',
  target_is_admin: 'Essa conta é de administrador. Tire o acesso em Administradores antes.',
  account_not_found: 'Conta não encontrada.',
  invalid_action: 'Ação inválida.',
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

// ------------------------------------------------------------------- criar conta (convite)

async function setup(asUser: SupabaseClient, newUserId: string, body: NewUser): Promise<string | null> {
  const plan = body.plan_slug === 'gratis' ? null : body.plan_slug
  const { error } = await asUser.rpc('admin_setup_new_user', {
    p_user_id: newUserId,
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

async function createAccount(admin: SupabaseClient, asUser: SupabaseClient, body: NewUser): Promise<Response> {
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
}

// ------------------------------------------------------------------- ações na conta

async function logAction(asUser: SupabaseClient, action: Exclude<Action, { action: 'view' }>, details: Record<string, unknown>) {
  const { error } = await asUser.rpc('admin_log_user_action', { p_user_id: action.user_id, p_action: action.action, p_reason: action.reason, p_details: details })
  // A ação já aconteceu: falha de auditoria vai para o log do servidor, não desfaz nada.
  if (error) console.error('admin-users audit', action.action, action.user_id, error.message)
}

async function accountAction(admin: SupabaseClient, asUser: SupabaseClient, action: Exclude<Action, { action: 'view' }>): Promise<Response> {
  const { data: checked, error: checkError } = await asUser.rpc('admin_check_user_action', {
    p_user_id: action.user_id,
    p_action: action.action,
    p_reason: action.reason,
  })
  if (checkError) return refusal(checkError)
  const email = z.object({ email: z.string().nullable() }).parse(checked).email

  if (action.action === 'delete') {
    if (!email || action.confirm_email !== email.toLowerCase()) {
      return errorResponse(400, 'confirmation_mismatch', 'Digite o e-mail da conta exatamente como aparece para confirmar.')
    }
    try {
      const result = await deleteAccountData(admin, action.user_id)
      await logAction(asUser, action, { email, canceled_subscriptions: result.canceledSubscriptions })
    } catch (error) {
      if (error instanceof PaymentCancelError) {
        return errorResponse(502, 'payment_unavailable', 'O Asaas não cancelou a assinatura agora. Nada foi apagado; tente de novo em instantes.')
      }
      throw error
    }
    return json({ done: true })
  }

  if (action.action === 'password') {
    const { error } = await admin.auth.admin.updateUserById(action.user_id, { password: action.password })
    if (error) {
      console.error('admin-users password', action.user_id, error.message)
      return errorResponse(400, 'weak_password', 'O Auth recusou essa senha. Use pelo menos 8 caracteres, misturando letras e números.')
    }
    await logAction(asUser, action, { method: 'set' })
    return json({ done: true })
  }

  if (!email) return errorResponse(400, 'no_email', 'Essa conta não tem e-mail para receber o código.')
  const { error } = await asUser.auth.resetPasswordForEmail(email)
  if (error) {
    console.error('admin-users reset', action.user_id, error.message)
    return errorResponse(502, 'reset_failed', 'O e-mail não saiu. Confira o SMTP do Auth e tente de novo.')
  }
  await logAction(asUser, action, { method: 'reset_link' })
  return json({ done: true })
}

// ------------------------------------------------------------------- ver como usuário

const SIGNED_URL_SECONDS = 600

async function viewAs(admin: SupabaseClient, asUser: SupabaseClient, targetId: string): Promise<Response> {
  const { data, error } = await asUser.rpc('admin_user_view', { p_user_id: targetId })
  if (error) return refusal(error)
  const view = data as { generations?: { output_path: string | null }[]; personas?: { image_path: string }[]; profile?: { avatar_path: string | null } }
  // Só arquivos da pasta da própria pessoa: o caminho vem do banco, mas a regra é conferida de novo aqui.
  const paths = [
    ...(view.generations ?? []).map((generation) => generation.output_path),
    ...(view.personas ?? []).map((persona) => persona.image_path),
  ].filter((path): path is string => typeof path === 'string' && path.startsWith(`${targetId}/`))

  const urls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed, error: signError } = await admin.storage.from('media').createSignedUrls([...new Set(paths)], SIGNED_URL_SECONDS)
    if (signError) console.error('admin-users sign', targetId, signError.message)
    for (const item of signed ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
  }
  return json({ ...view, media_urls: urls })
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const callerId = await authenticatedUserId(request, admin)
    if (!callerId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const raw = await readJson(request)
    const asUser = userClient(request)
    const hasAction = typeof raw === 'object' && raw !== null && 'action' in raw

    if (!hasAction) {
      const parsed = createSchema.safeParse(raw)
      if (!parsed.success) return errorResponse(400, 'invalid_body', 'Confira nome, e-mail, plano e motivo.')
      return createAccount(admin, asUser, parsed.data)
    }

    const parsed = actionSchema.safeParse(raw)
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Confira a conta, o motivo (pelo menos 5 caracteres) e a senha (pelo menos 8).')
    const action = parsed.data
    if (action.action === 'view') return viewAs(admin, asUser, action.user_id)
    return accountAction(admin, asUser, action)
  }),
)
