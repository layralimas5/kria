import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
  /** O gatilho recebe as props de acessibilidade e o toggle. */
  readonly trigger: (props: { open: boolean; toggle: () => void; controls: string }) => ReactNode
  readonly children: (close: () => void) => ReactNode
  readonly label: string
  readonly align?: 'start' | 'end'
  /** Abre acima do gatilho (padrão, para a caixa de prompt no rodapé) ou abaixo. */
  readonly side?: 'top' | 'bottom'
  readonly className?: string
}

/** Painel que abre acima do gatilho. Fecha com Esc, clique fora ou ao escolher. */
export function Popover({ trigger, children, label, align = 'start', side = 'top', className }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value), controls: id })}
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="dialog"
            aria-label={label}
            initial={reduceMotion ? false : { opacity: 0, y: side === 'top' ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: side === 'top' ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              // Fundo sólido: dentro da caixa de prompt (que já tem backdrop-blur) um blur aninhado não funciona.
              'absolute z-50 rounded-2xl border border-white/[0.08] bg-surface-2 p-2 shadow-2xl shadow-black/70',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
              align === 'end' ? 'right-0' : 'left-0',
              className,
            )}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
