import { useCallback, useMemo, useState } from 'react'
import { buildNotifications, unreadCount, type AppNotification } from '@/domain/notifications'
import { useGenerations } from './useGenerations'

const SEEN_KEY = 'kria-notifications-seen-at'

function readSeenAt(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeenAt(value: string): void {
  try {
    localStorage.setItem(SEEN_KEY, value)
  } catch (storageError) {
    // Aba anônima ou armazenamento bloqueado: o selo volta ao recarregar, nada além disso.
    console.warn('não deu para guardar a leitura das notificações', storageError)
  }
}

interface NotificationsState {
  readonly notifications: readonly AppNotification[]
  readonly unread: number
  /** Última abertura do sino; null se nunca abriu. */
  readonly seenAt: string | null
  readonly markAllSeen: () => void
}

export function useNotifications(): NotificationsState {
  const { generations } = useGenerations()
  const [seenAt, setSeenAt] = useState(readSeenAt)
  const notifications = useMemo(() => buildNotifications(generations, new Date()), [generations])
  const unread = unreadCount(notifications, seenAt)

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString()
    writeSeenAt(now)
    setSeenAt(now)
  }, [])

  return { notifications, unread, seenAt, markAllSeen }
}
