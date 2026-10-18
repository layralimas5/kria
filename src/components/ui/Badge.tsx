import clsx from 'clsx'

/** Selo curto em caixa alta (NOVO, TOP), no estilo dos lançamentos. */
export function Badge({ children, className }: { readonly children: string; readonly className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-[5px] bg-accent px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-accent-ink italic',
        className,
      )}
    >
      {children}
    </span>
  )
}
