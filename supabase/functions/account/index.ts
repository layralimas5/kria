// POST { action: 'export' }                         devolve os dados da conta em JSON (LGPD, art. 18)
// POST { action: 'delete', confirmation: 'EXCLUIR' } cancela a assinatura, apaga arquivos e a conta
//
// A exclusão cancela primeiro a cobrança no Asaas: se falhar lá, a conta fica
// para não deixar uma assinatura cobrando alguém que não existe mais aqui.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { deleteSubscription } from '../_shared/asaas.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, json, readJson } from '../_shared/http.ts'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('export') }),
  z.object({ action: z.literal('delete'), confirmation: z.literal('EXCLUIR') }),
])

const EXPORT_TABLES = [
  { table: 'profiles', key: 'id' },
  { table: 'user_preferences', key: 'user_id' },
  { table: 'credit_balances', key: 'user_id' },
  { table: 'credit_ledger', key: 'user_id' },
  { table: 'personas', key: 'user_id' },
  { table: 'generations', key: 'user_id' },
  { table: 'purchases', key: 'user_id' },
  { table: 'subscriptions', key: 'user_id' },
  { table: 'subscription_payments', key: 'user_id' },
] as const

async function exportData(admin: SupabaseClient, userId: string, email: string | null): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: userId, email } }
  for (const { table, key } of EXPORT_TABLES) {
    const { data, error } = await admin.from(table).select('*').eq(key, userId)
    if (error) throw new Error(`export ${table}: ${error.message}`)
    result[table] = data
  }
  return result
}

async function removeFiles(admin: SupabaseClient, userId: string): Promise<void> {
  const bucket = admin.storage.from('media')
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 1000 })
    if (error) throw new Error(`storage list: ${error.message}`)
    if (!data || data.length === 0) return
    const { error: removeError } = await bucket.remove(data.map((file) => `${userId}/${file.name}`))
    if (removeError) throw new Error(`storage remove: ${removeError.message}`)
  }
}

async function deleteAccount(admin: SupabaseClient, userId: string): Promise<Response> {
  const { data: subscriptions, error } = await admin
    .from('subscriptions')
    .select('provider_subscription_id')
    .eq('user_id', userId)
    .in('status', ['active', 'past_due', 'pending'])
    .not('provider_subscription_id', 'is', null)
  if (error) throw new Error(`subscriptions: ${error.message}`)

  try {
    for (const row of subscriptions ?? []) await deleteSubscription(row.provider_subscription_id as string)
  } catch (cancelError) {
    console.error('delete account: cancel subscription failed', cancelError)
    return errorResponse(502, 'payment_unavailable', 'Não conseguimos cancelar sua assinatura agora. Tente de novo em instantes.')
  }

  await removeFiles(admin, userId)
  // O resto (perfil, extrato, gerações, assinaturas) sai em cascata com o usuário.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) throw new Error(`deleteUser: ${deleteError.message}`)
  return json({ deleted: true })
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')

    if (parsed.data.action === 'delete') return deleteAccount(admin, userId)

    const { data: user } = await admin.auth.admin.getUserById(userId)
    return json(await exportData(admin, userId, user.user?.email ?? null))
  }),
)
