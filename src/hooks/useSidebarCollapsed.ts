import { useCallback, useState } from 'react'

const APP_KEY = 'kria-sidebar-collapsed'

function readSaved(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/** Barra lateral recolhida (só ícones). Lembra a escolha neste navegador, uma por moldura (app e admin). */
export function useSidebarCollapsed(key: string = APP_KEY): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readSaved(key))

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // Sem armazenamento (aba anônima): a escolha vale só nesta visita.
      }
      return next
    })
  }, [key])

  return [collapsed, toggle]
}
