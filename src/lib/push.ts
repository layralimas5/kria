// Inscrição deste aparelho nas notificações (Web Push). Quem envia é o servidor (`_shared/push.ts`).
import { z } from 'zod'
import { deviceLabel, detectPlatform, type PushTopic } from '@/domain/appDevice'
import { ApiError, invoke } from './api'
import { supabase } from './supabase'

const READY_TIMEOUT_MS = 10_000
const topicsSchema = z.array(z.enum(['generations', 'sales']))

export const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ApiError('sw_unavailable', 'O app ainda está carregando. Tente de novo em instantes.')), READY_TIMEOUT_MS),
  )
  return Promise.race([navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready), timeout])
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  return existing ? existing.pushManager.getSubscription() : null
}

/** Tópicos que este aparelho recebe hoje, conforme o banco. Vazio se não está inscrito. */
export async function readDeviceTopics(): Promise<PushTopic[]> {
  const subscription = await currentSubscription()
  if (!subscription) return []
  const { data, error } = await supabase.from('push_subscriptions').select('topics').eq('endpoint', subscription.endpoint).maybeSingle()
  if (error) throw new ApiError('push_unavailable', 'Não deu para ler as notificações deste aparelho.')
  return data ? topicsSchema.catch([]).parse(data.topics) : []
}

const SAVE_ERRORS: Record<string, string> = {
  forbidden: 'Aviso de venda é só para quem administra com acesso ao financeiro, com o segundo fator ativo.',
  invalid_push_endpoint: 'Este navegador usa um serviço de notificação que o Vynkio não reconhece.',
}

async function save(subscription: PushSubscription, topics: readonly PushTopic[]): Promise<PushTopic[]> {
  const json = subscription.toJSON()
  const { data, error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_topics: topics,
    p_device_label: deviceLabel(navigator.userAgent, detectPlatform(navigator.userAgent, navigator.maxTouchPoints)),
  })
  if (error) throw new ApiError(error.message, SAVE_ERRORS[error.message] ?? 'Não deu para ligar as notificações. Tente de novo.')
  return topicsSchema.parse(data)
}

/**
 * Grava os tópicos deste aparelho. Lista vazia desinscreve. Pedir permissão precisa partir de um
 * toque da pessoa, então só chamar dentro de um clique.
 */
export async function setDeviceTopics(topics: readonly PushTopic[]): Promise<PushTopic[]> {
  if (topics.length === 0) {
    await disableDevice()
    return []
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new ApiError('permission_denied', 'O navegador não liberou as notificações. Libere nas permissões do site e tente de novo.')
  }
  const worker = await registration()
  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(vapidPublicKey) }))
  return save(subscription, topics)
}

export async function disableDevice(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  const { error } = await supabase.rpc('remove_push_subscription', { p_endpoint: subscription.endpoint })
  if (error) throw new ApiError('push_unavailable', 'Não deu para desligar agora. Tente de novo.')
  await subscription.unsubscribe()
}

/**
 * Saiu da conta: o aparelho para de receber na hora. O servidor apaga a linha no próximo envio
 * (o serviço de push responde 410), então funciona mesmo sem sessão.
 */
export async function forgetDeviceAfterSignOut(): Promise<void> {
  const subscription = await currentSubscription().catch(() => null)
  await subscription?.unsubscribe().catch(() => false)
}

export async function sendTestPush(): Promise<number> {
  const result = z.object({ delivered: z.number() }).parse(await invoke('push-test', {}))
  return result.delivered
}
