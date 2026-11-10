import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { goShortcutFor, isTypingTarget, type Command, type GoShortcut } from '@/domain/commands'
import { CommandPalette } from '@/components/command/CommandPalette'
import { ShortcutsDialog } from '@/components/command/ShortcutsDialog'

interface PaletteControls {
  readonly openPalette: () => void
  readonly openShortcuts: () => void
}

const PaletteContext = createContext<PaletteControls | null>(null)

/** Abre a busca e a lista de atalhos de qualquer botão dentro da moldura. */
export function useCommandPalette(): PaletteControls {
  const controls = useContext(PaletteContext)
  if (!controls) throw new Error('useCommandPalette fora do CommandProvider')
  return controls
}

/** Tempo para a segunda tecla do "G + letra". */
const GO_WINDOW_MS = 1200

interface CommandProviderProps {
  /** Separa os recentes do app e do admin no navegador. */
  readonly scope: 'app' | 'admin'
  readonly commands: readonly Command[]
  readonly goShortcuts: readonly GoShortcut[]
  /** Busca remota (clientes, no admin) a partir de 3 letras. */
  readonly search?: (query: string) => Promise<Command[]>
  readonly children: ReactNode
}

/**
 * Atalhos globais da moldura: Ctrl/⌘+K ou "/" abrem a busca, "?" mostra os atalhos e "G + letra"
 * vai direto para a tela. Nenhum atalho dispara enquanto a pessoa digita num campo.
 */
export function CommandProvider({ scope, commands, goShortcuts, search, children }: CommandProviderProps) {
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const pendingGo = useRef<number | null>(null)
  const shortcutsRef = useRef(goShortcuts)
  shortcutsRef.current = goShortcuts

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShortcutsOpen(false)
        setPaletteOpen((open) => !open)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      if (document.querySelector('dialog[open]')) return

      if (pendingGo.current !== null) {
        window.clearTimeout(pendingGo.current)
        pendingGo.current = null
        const target = goShortcutFor(event.key, shortcutsRef.current)
        if (target) {
          event.preventDefault()
          navigate(target.to)
        }
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        setPaletteOpen(true)
      } else if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
      } else if (event.key.toLowerCase() === 'g' && !event.shiftKey) {
        pendingGo.current = window.setTimeout(() => {
          pendingGo.current = null
        }, GO_WINDOW_MS)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (pendingGo.current !== null) window.clearTimeout(pendingGo.current)
    }
  }, [navigate])

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])
  const controls = useMemo(() => ({ openPalette, openShortcuts }), [openPalette, openShortcuts])

  return (
    <PaletteContext.Provider value={controls}>
      {children}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        scope={scope}
        commands={commands}
        search={search}
        onShowShortcuts={() => {
          setPaletteOpen(false)
          setShortcutsOpen(true)
        }}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} goShortcuts={goShortcuts} />
    </PaletteContext.Provider>
  )
}
