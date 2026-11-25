import { useCallback, useEffect, useState } from 'react'
import { pushAvailability, toggleTopic, type PushAvailability, type PushTopic } from '@/domain/appDevice'
import { errorMessage } from '@/lib/api'
import { readDeviceTopics, sendTestPush, setDeviceTopics, vapidPublicKey } from '@/lib/push'
import { readDevice } from '@/lib/pwa'
import { isDemo } from '@/lib/supabase'

export type PushStatus = 'loading' | 'demo' | PushAvailability

export interface PushNotifications {
  readonly status: PushStatus
  readonly topics: readonly PushTopic[]
  readonly busy: boolean
  readonly error: string | null
  readonly notice: string | null
  readonly setTopic: (topic: PushTopic, on: boolean) => Promise<void>
  readonly sendTest: () => Promise<void>
}

/** Estado das notificações neste aparelho e as ações de ligar, desligar e testar. */
export function usePushNotifications(): PushNotifications {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [topics, setTopics] = useState<readonly PushTopic[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) {
      setStatus('demo')
      return
    }
    let active = true
    const availability = pushAvailability(readDevice(), vapidPublicKey.length > 0)
    if (availability !== 'ready') {
      setStatus(availability)
      return
    }
    readDeviceTopics()
      .then((saved) => {
        if (!active) return
        // Permissão revogada pelo navegador: o que está no banco não chega mais.
        setTopics(Notification.permission === 'granted' ? saved : [])
        setStatus('ready')
      })
      .catch((readError: unknown) => {
        if (!active) return
        setError(errorMessage(readError))
        setStatus('ready')
      })
    return () => {
      active = false
    }
  }, [])

  const setTopic = useCallback(
    async (topic: PushTopic, on: boolean) => {
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        setTopics(await setDeviceTopics(toggleTopic(topics, topic, on)))
      } catch (toggleError) {
        setError(errorMessage(toggleError))
        if (Notification.permission === 'denied') setStatus('denied')
      } finally {
        setBusy(false)
      }
    },
    [topics],
  )

  const sendTest = useCallback(async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const delivered = await sendTestPush()
      setNotice(
        delivered > 0
          ? `Teste enviado para ${delivered} ${delivered === 1 ? 'aparelho' : 'aparelhos'}. Pode levar alguns segundos.`
          : 'Nenhum aparelho recebeu. Desligue e ligue de novo neste aparelho.',
      )
    } catch (testError) {
      setError(errorMessage(testError))
    } finally {
      setBusy(false)
    }
  }, [])

  return { status, topics, busy, error, notice, setTopic, sendTest }
}
