import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { Kbd, modKey } from './Kbd'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Abre a busca global. Largo no desktop (parece um campo), só o ícone no celular. */
export function SearchTrigger({ compact = false, className }: { readonly compact?: boolean; readonly className?: string }) {
  const { openPalette } = useCommandPalette()
  if (compact) {
    return (
      <button
        type="button"
        onClick={openPalette}
        aria-label="Buscar"
        className={clsx('grid size-9 shrink-0 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50', FOCUS, className)}
      >
        <Search className="size-[18px]" aria-hidden="true" />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-keyshortcuts="Control+K Meta+K"
      className={clsx(
        'group flex min-h-9 w-full max-w-sm items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] pl-3 pr-1.5 text-left text-[13px] text-zinc-500 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-zinc-300',
        FOCUS,
        className,
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">Buscar ou ir para...</span>
      <span className="flex shrink-0 gap-1" aria-hidden="true">
        <Kbd>{modKey()}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}
