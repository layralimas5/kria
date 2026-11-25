import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAccount } from '@/hooks/useAccount'
import { usePlanModels } from '@/hooks/usePlanModels'
import { AdminShortcut } from './AdminShortcut'
import { compactGroups, shortLabel } from './mobileMenu'
import { navGroupsFor, type NavItem } from './nav'

const TILE = 'flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-semibold leading-tight'

function Tile({ item, active, onNavigate }: { readonly item: NavItem; readonly active: boolean; readonly onNavigate: () => void }) {
  const Icon = item.icon
  const label = shortLabel(item.label)
  if (item.soon) {
    return (
      <li aria-disabled="true" className={clsx(TILE, 'text-zinc-600')}>
        <Icon className="size-5" aria-hidden="true" />
        <span>{label}</span>
        <span className="sr-only">, em breve</span>
      </li>
    )
  }
  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={clsx(
          TILE,
          'w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          active ? 'bg-accent/15 text-zinc-50 ring-1 ring-accent/30' : 'text-zinc-300 active:bg-white/[0.06]',
        )}
      >
        <Icon className={clsx('size-5', active ? 'text-accent-soft' : 'text-zinc-400')} aria-hidden="true" />
        <span className="line-clamp-2 break-words">{label}</span>
      </Link>
    </li>
  )
}

interface MobileMenuSheetProps {
  readonly open: boolean
  readonly onClose: () => void
}

/**
 * Gaveta que sobe de baixo com todas as áreas, em grade, sem rolagem. `<dialog>` nativo em modo modal:
 * prende o foco, fecha com Esc, com toque fora e ao escolher um destino.
 */
export function MobileMenuSheet({ open, onClose }: MobileMenuSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { plan } = useAccount()
  const { kinds } = usePlanModels()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-dvh w-full max-w-full rounded-t-3xl bg-canvas p-0 text-zinc-100 ring-1 ring-white/[0.08] backdrop:bg-black/60 backdrop:backdrop-blur-sm motion-safe:open:animate-sheet-in md:hidden"
    >
      {open && (
        <nav aria-labelledby={titleId} className="px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
          <div className="flex items-center justify-between px-1">
            <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15" />
            <h2 id={titleId} className="pt-2 text-sm font-bold text-zinc-100">
              Menu
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar menu"
              className="mt-1 grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-1 [&_a]:min-h-10" onClickCapture={onClose}>
            <AdminShortcut collapsed={false} />
          </div>
          {compactGroups(navGroupsFor(plan, kinds)).map((group) => (
            <section key={group.title} aria-label={group.title} className="mt-2">
              <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{group.title}</p>
              <ul className="grid grid-cols-4 gap-1">
                {group.items.map((item) => (
                  <Tile key={item.label} item={item} active={item.isActive(pathname, params)} onNavigate={onClose} />
                ))}
              </ul>
            </section>
          ))}
        </nav>
      )}
    </dialog>
  )
}
