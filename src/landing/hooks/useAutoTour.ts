import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

interface AutoTour {
  readonly active: number
  /** 0 a 1: quanto do tempo da aba atual já passou. */
  readonly progress: number
  readonly running: boolean
  /** Escolha da pessoa: troca a aba e para o avanço automático de vez. */
  readonly select: (index: number) => void
  readonly pause: (paused: boolean) => void
}

/**
 * Avança as abas sozinho enquanto a seção está na tela. Para quando a pessoa escolhe uma aba,
 * pausa no hover ou foco, e não roda com movimento reduzido.
 */
export function useAutoTour(count: number, durationMs: number, enabled: boolean, target: RefObject<HTMLElement | null>): AutoTour {
  const [active, setActive] = useState(0)
  const [progress, setProgress] = useState(0)
  const [stopped, setStopped] = useState(!enabled)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const elapsed = useRef(0)

  useEffect(() => {
    const element = target.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), { threshold: 0.35 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [target])

  const running = !stopped && !paused && visible && count > 1

  useEffect(() => {
    if (!running) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      elapsed.current += now - last
      last = now
      if (elapsed.current >= durationMs) {
        elapsed.current = 0
        setActive((current) => (current + 1) % count)
      }
      setProgress(elapsed.current / durationMs)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, count, durationMs])

  const select = useCallback((index: number) => {
    setStopped(true)
    elapsed.current = 0
    setProgress(0)
    setActive(index)
  }, [])

  return { active, progress, running, select, pause: setPaused }
}
