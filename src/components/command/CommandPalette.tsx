import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CornerDownLeft, History, Keyboard, Loader2, Search, UserRound, Zap } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { filterCommands, pushRecent, uniqueById, type Command, type CommandGroup } from '@/domain/commands'
import { Kbd } from './Kbd'

const GROUP_ICONS: Readonly<Record<CommandGroup, ReactNode>> = {
  Recentes: <History className="size-4" aria-hidden="true" />,
  'Ir para': <ArrowRight className="size-4" aria-hidden="true" />,
  Ações: <Zap className="size-4" aria-hidden="true" />,
  Clientes: <UserRound className="size-4" aria-hidden="true" />,
  Admin: <ArrowRight className="size-4" aria-hidden="true" />,
}

function readRecent(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveRecent(key: string, ids: readonly string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Sem armazenamento (aba anônima): os recentes valem só nesta visita.
  }
}

interface CommandPaletteProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly scope: 'app' | 'admin'
  readonly commands: readonly Command[]
  readonly search?: (query: string) => Promise<Command[]>
  readonly onShowShortcuts: () => void
}

/**
 * Busca global no padrão combobox: digitar filtra, setas escolhem, Enter abre, Esc fecha. `<dialog>`
 * modal prende o foco e devolve para quem abriu.
 */
export function CommandPalette({ open, onClose, scope, commands, search, onShowShortcuts }: CommandPaletteProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const recentKey = `vynkio.palette.recent.${scope}`
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const [remote, setRemote] = useState<Command[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setQuery('')
      setActive(0)
      setRemote([])
      setRecent(readRecent(recentKey))
      dialog.showModal()
      window.requestAnimationFrame(() => inputRef.current?.focus())
    }
    if (!open && dialog.open) dialog.close()
  }, [open, recentKey])

  // Busca remota com pausa: só a partir de 3 letras e só a última resposta vale.
  useEffect(() => {
    if (!search || query.trim().length < 3) {
      setRemote([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      search(query.trim())
        .then((found) => {
          if (!cancelled) setRemote(found)
        })
        .catch((searchError: unknown) => {
          console.error('busca remota', searchError)
          if (!cancelled) setRemote([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, search])

  const results = useMemo(() => {
    const byId = new Map(commands.map((command) => [command.id, command]))
    const recents = query.trim()
      ? []
      : recent.flatMap((id) => {
          const command = byId.get(id)
          return command ? [{ ...command, group: 'Recentes' as const }] : []
        })
    return uniqueById([...recents, ...filterCommands(query, commands), ...remote])
  }, [commands, query, recent, remote])

  useEffect(() => setActive(0), [query, remote])

  function choose(command: Command) {
    const next = pushRecent(recent, command.id)
    if (command.group !== 'Clientes') saveRecent(recentKey, next)
    onClose()
    if (command.to) navigate(command.to)
    else command.run?.()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (results.length === 0 ? 0 : (index + 1) % results.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (results.length === 0 ? 0 : (index - 1 + results.length) % results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = results[active]
      if (command) choose(command)
    } else if (event.key === 'Home') {
      setActive(0)
    } else if (event.key === 'End') {
      setActive(Math.max(0, results.length - 1))
    }
  }

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  const groups = results.reduce<{ group: CommandGroup; items: { command: Command; index: number }[] }[]>((acc, command, index) => {
    const last = acc.at(-1)
    if (last && last.group === command.group) last.items.push({ command, index })
    else acc.push({ group: command.group, items: [{ command, index }] })
    return acc
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label="Buscar no Vynkio"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-0 mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl bg-transparent p-0 text-zinc-100 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="card-premium overflow-hidden rounded-2xl shadow-2xl shadow-black/60"
        >
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
            <Search className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results.length > 0 ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              aria-label="Buscar telas, ações e clientes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={scope === 'admin' ? 'Buscar telas, ações ou cliente por e-mail...' : 'Buscar telas e ações...'}
              maxLength={120}
              className="min-h-14 min-w-0 flex-1 bg-transparent text-[15px] text-zinc-50 placeholder:text-zinc-500 focus:outline-none"
            />
            {searching && <Loader2 className="size-4 animate-spin text-zinc-500" aria-label="Buscando" />}
            <Kbd>Esc</Kbd>
          </div>

          <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-zinc-500">
                {searching ? 'Buscando...' : `Nada encontrado para "${query.trim()}".`}
              </p>
            ) : (
              groups.map(({ group, items }) => (
                <div key={group} role="group" aria-label={group} className="mb-1">
                  <p aria-hidden="true" className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    {group}
                  </p>
                  {items.map(({ command, index }) => (
                    <div
                      key={`${group}-${command.id}`}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={() => choose(command)}
                      className={clsx(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                        index === active ? 'bg-accent/15 text-zinc-50 ring-1 ring-accent/30' : 'text-zinc-300',
                      )}
                    >
                      <span className={clsx('grid size-7 shrink-0 place-items-center rounded-lg', index === active ? 'bg-accent/25 text-accent-soft' : 'bg-white/[0.04] text-zinc-500')}>
                        {GROUP_ICONS[command.group]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{command.label}</span>
                      {command.section && <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">{command.section}</span>}
                      {command.shortcut && (
                        <span className="hidden shrink-0 gap-1 sm:flex">
                          {command.shortcut.split(' ').map((key, position) => (
                            <Kbd key={`${key}-${position}`}>{key}</Kbd>
                          ))}
                        </span>
                      )}
                      {index === active && <CornerDownLeft className="size-4 shrink-0 text-accent-soft" aria-hidden="true" />}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-zinc-500">
            <span className="hidden items-center gap-3 sm:flex">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navegar
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> abrir
              </span>
            </span>
            <button
              type="button"
              onClick={onShowShortcuts}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-semibold text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Keyboard className="size-3.5" aria-hidden="true" />
              Atalhos do teclado <Kbd>?</Kbd>
            </button>
          </div>
        </motion.div>
      )}
    </dialog>
  )
}
