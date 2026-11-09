import { Info } from 'lucide-react'
import { useId, useState } from 'react'

/** Explica uma métrica: abre ao passar o mouse, no foco do teclado ou no toque. */
export function InfoTip({ label, children }: { readonly label: string; readonly children: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`O que é ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        className="grid size-5 place-items-center rounded-full text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-1.5 w-60 -translate-x-1/2 rounded-xl bg-surface-3 px-3 py-2 text-xs font-normal leading-relaxed text-zinc-200 shadow-lg shadow-black/50 ring-1 ring-white/[0.08]"
        >
          {children}
        </span>
      )}
    </span>
  )
}
