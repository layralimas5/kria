// Exclusão de conta, usada pela própria pessoa (function `account`) e pelo admin (`admin-users`).
// Cancela primeiro a cobrança no Asaas: se falhar lá, a conta fica, para não deixar uma assinatura
// cobrando alguém que não existe mais aqui. Depois apaga os arquivos e o usuário do Auth; o resto
// (perfil, extrato, gerações, assinaturas) sai em cascata.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { deleteSubscription } from './asaas.ts'

export class PaymentCancelError extends Error {}

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

export async function deleteAccountData(admin: SupabaseClient, userId: string): Promise<{ canceledSubscriptions: number }> {
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
    throw new PaymentCancelError('payment_unavailable')
  }

  await removeFiles(admin, userId)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) throw new Error(`deleteUser: ${deleteError.message}`)
  return { canceledSubscriptions: subscriptions?.length ?? 0 }
}
