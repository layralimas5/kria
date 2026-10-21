import { useCallback, useEffect, useState } from 'react'

/** Contagem regressiva em segundos. `start` reinicia; `remaining` 0 libera a ação de novo. */
export function useCooldown(seconds: number, startActive = false) {
  const [remaining, setRemaining] = useState(startActive ? seconds : 0)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])

  const start = useCallback(() => setRemaining(seconds), [seconds])
  return { remaining, start }
}
