import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** Encerra a sessão depois de `minutes` sem interação. Usado no painel de operação. */
export function useIdleSignOut(minutes: number) {
  const navigate = useNavigate()

  useEffect(() => {
    let timer = 0
    const expire = () => {
      supabase.auth
        .signOut()
        .catch((error: unknown) => console.error('idle sign out', error))
        .finally(() => navigate('/entrar', { replace: true, state: { reason: 'idle' } }))
    }
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(expire, minutes * 60 * 1000)
    }
    restart()
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, restart, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, restart))
    }
  }, [minutes, navigate])
}
