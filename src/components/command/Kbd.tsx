import clsx from 'clsx'
import type { ReactNode } from 'react'

/** Tecla desenhada ("⌘", "K", "Esc"). */
export function Kbd({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <kbd
      className={clsx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] px-1 font-sans text-[11px] font-semibold text-zinc-400 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** "⌘" no Mac, "Ctrl" no resto. */
export function modKey(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'
}
