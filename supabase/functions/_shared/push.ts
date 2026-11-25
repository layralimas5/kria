// Envio de notificação aos aparelhos (docs/app-e-notificacoes.md). Nunca lança: notificação é
// cortesia, e falhar aqui não pode estragar o webhook do Asaas nem o fechamento de uma geração.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { PushMessage } from './pushMessages.ts'
import { buildPushRequest, isGone, type PushTarget, type VapidKeys } from './webPush.ts'

interface TargetRow extends PushTarget {
  readonly id: string
}

const SEND_TIMEOUT_MS = 8_000
/** Venda pode esperar o aparelho ligar (1 dia); geração pronta perde sentido depois de algumas horas. */
const TTL_SECONDS = { sales: 86_400, generations: 6 * 3_600, test: 600 } as const

function vapidFromEnv(): VapidKeys | null {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:suporte@vynkio-ia.com.br'
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null
}

async function sendOne(admin: SupabaseClient, vapid: VapidKeys, target: TargetRow, message: PushMessage): Promise<boolean> {
  try {
    const request = await buildPushRequest(target, message, vapid, {
      ttlSeconds: TTL_SECONDS[message.topic],
      urgency: message.topic === 'generations' ? 'normal' : 'high',
    })
    const response = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) })
    await response.body?.cancel()
    if (isGone(response.status)) {
      await admin.from('push_subscriptions').delete().eq('id', target.id)
      return false
    }
    if (!response.ok) {
      console.error('push recusado', response.status, new URL(target.endpoint).host)
      await admin.rpc('push_register_failure', { p_id: target.id })
      return false
    }
    await admin.from('push_subscriptions').update({ last_sent_at: new Date().toISOString(), failures: 0 }).eq('id', target.id)
    return true
  } catch (error) {
    console.error('push falhou', new URL(target.endpoint).host, error)
    return false
  }
}

/** Manda para os aparelhos do tópico (`userId` em generations e test). Devolve quantos aceitaram. */
export async function sendPush(admin: SupabaseClient, message: PushMessage, userId: string | null = null): Promise<number> {
  try {
    const vapid = vapidFromEnv()
    if (!vapid) {
      console.warn('push desligado: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configurados')
      return 0
    }
    const { data, error } = await admin.rpc('push_targets', { p_topic: message.topic, p_user_id: userId })
    if (error) throw new Error(`push_targets: ${error.message}`)
    const targets = (data ?? []) as TargetRow[]
    const results = await Promise.all(targets.map((target) => sendOne(admin, vapid, target, message)))
    return results.filter(Boolean).length
  } catch (error) {
    console.error('push', message.topic, error)
    return 0
  }
}
