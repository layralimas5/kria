import clsx from 'clsx'

type LogoSize = 'md' | 'lg'

const MARK_SIZE: Record<LogoSize, { box: string; icon: string }> = {
  md: { box: 'size-8 rounded-[9px]', icon: 'size-[18px]' },
  lg: { box: 'size-12 rounded-[13px]', icon: 'size-7' },
}

const WORD_SIZE: Record<LogoSize, string> = {
  md: 'text-[19px]',
  lg: 'text-[30px]',
}

/** Só o símbolo: o V do Vynkio no gradiente roxo e azul da Nivora, com o ponto dourado. */
export function LogoMark({ size = 'md' }: { readonly size?: LogoSize }) {
  return (
    <span
      className={clsx('grid place-items-center bg-[linear-gradient(135deg,var(--color-accent),var(--color-galaxy))]', MARK_SIZE[size].box)}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className={MARK_SIZE[size].icon} fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 6.5 12 19l7-12.5" />
        <circle cx="12" cy="5.2" r="1.9" fill="var(--color-hot)" stroke="none" />
      </svg>
    </span>
  )
}

/** Marca escrita "Vynkio". */
export function Logo({ size = 'md' }: { readonly size?: LogoSize }) {
  return (
    <span className={clsx('flex items-center', size === 'lg' ? 'gap-3' : 'gap-2.5')}>
      <LogoMark size={size} />
      <span className={clsx('font-display font-bold leading-none tracking-[-0.03em] text-zinc-50', WORD_SIZE[size])}>Vynkio</span>
    </span>
  )
}
