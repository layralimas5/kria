import clsx from 'clsx'

/** Selo curto inclinado, igual ao da landing: NOVO em laranja, TOP em rosa. */
const TONES: Record<string, string> = {
  NOVO: 'bg-accent text-accent-ink',
  TOP: 'bg-hot text-white',
}

export function Badge({ children, className }: { readonly children: string; readonly className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex -skew-x-6 items-center rounded-[5px] px-1.5 py-px text-[10px] font-bold italic tracking-wide',
        TONES[children] ?? 'bg-white/10 text-zinc-300',
        className,
      )}
    >
      {children}
    </span>
  )
}
