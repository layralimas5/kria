import clsx from 'clsx'

/** Selo curto e discreto: NOVO em roxo, TOP em dourado, sempre em pílula com contorno. */
const TONES: Record<string, string> = {
  NOVO: 'text-accent-soft ring-accent-soft/30 bg-accent/[0.08]',
  TOP: 'text-hot ring-hot/30 bg-hot/[0.08]',
}

export function Badge({ children, className }: { readonly children: string; readonly className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-1.5 text-[10px] font-medium uppercase leading-[18px] tracking-wide ring-1 ring-inset',
        TONES[children] ?? 'text-zinc-300 ring-white/[0.12]',
        className,
      )}
    >
      {children}
    </span>
  )
}
