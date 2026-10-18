import { useCallback, useState } from 'react'

const STORAGE_KEY = 'kria-sidebar-collapsed'

function readSaved(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Barra lateral recolhida (só ícones). Lembra a escolha neste navegador. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readSaved)

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Sem armazenamento (aba anônima): a escolha vale só nesta visita.
      }
      return next
    })
  }, [])

  return [collapsed, toggle]
}
