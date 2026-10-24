import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  readonly open: boolean
  readonly title: string
  readonly children: ReactNode
  readonly confirmLabel: string
  readonly busy?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * Confirmação de operação crítica. Usa o `<dialog>` nativo em modo modal: o navegador
 * prende o foco, fecha com Esc e devolve o foco a quem abriu.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
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
        if (!busy) onCancel()
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-zinc-100 ring-1 ring-white/[0.08] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-4 p-6">
        <h2 id={titleId} className="font-headline text-xl text-zinc-50">
          {title}
        </h2>
        <div className="space-y-2 text-sm text-pretty text-zinc-300">{children}</div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
