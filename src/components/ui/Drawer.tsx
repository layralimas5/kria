import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DrawerProps {
  readonly open: boolean
  readonly title: string
  readonly description?: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly footer?: ReactNode
  /** Largura no desktop; no celular ocupa a tela inteira. */
  readonly size?: 'md' | 'lg'
}

/**
 * Painel lateral sobre a página. `<dialog>` nativo em modo modal: o navegador prende o foco,
 * fecha com Esc e devolve o foco a quem abriu. No celular vira tela cheia.
 */
export function Drawer({ open, title, description, onClose, children, footer, size = 'md' }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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
      className={`fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full ${size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-w-full bg-canvas p-0 text-zinc-100 ring-1 ring-white/[0.08] backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col motion-safe:open:animate-drawer-in`}
    >
      <header className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate font-headline text-xl text-zinc-50">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-zinc-400">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{open && children}</div>
      {footer && <footer className="border-t border-white/[0.06] px-5 py-4">{footer}</footer>}
    </dialog>
  )
}
