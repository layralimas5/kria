import { useEffect, useState } from 'react'
import { fetchSupportAttention } from '@/lib/supportTicketsApi'

const REFRESH_MS = 60_000

/** Chamados novos ou com resposta não lida, para o número no menu do admin. Atualiza a cada minuto e ao voltar para a aba. */
export function useSupportAttention(enabled: boolean): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = () => {
      fetchSupportAttention()
        .then((value) => {
          if (alive) setCount(value)
        })
        .catch((error: unknown) => console.error('admin_support_attention', error))
    }
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('vynkio:support-changed', load)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('vynkio:support-changed', load)
    }
  }, [enabled])

  return enabled ? count : 0
}

/** A tela de chamados avisa o menu quando algo muda, para o número acompanhar na hora. */
export const announceSupportChange = (): void => {
  window.dispatchEvent(new Event('vynkio:support-changed'))
}
