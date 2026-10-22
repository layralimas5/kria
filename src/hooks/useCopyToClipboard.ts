import { useCallback, useEffect, useRef, useState } from 'react'

const FEEDBACK_MS = 1800

/** Copia um texto e diz qual chave foi copiada por um instante, para o botão mostrar "Copiado". */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setFailed(false)
      setCopied(key)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(null), FEEDBACK_MS)
    } catch (error) {
      console.warn('não deu para copiar', error)
      setFailed(true)
    }
  }, [])

  return { copied, failed, copy }
}
