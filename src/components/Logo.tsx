/** Só o símbolo: o V do Vynkio no gradiente roxo e azul da Nivora, com o ponto dourado. */
export function LogoMark() {
  return (
    <span className="grid size-8 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--color-accent),var(--color-galaxy))]" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 6.5 12 19l7-12.5" />
        <circle cx="12" cy="5.2" r="1.9" fill="var(--color-hot)" stroke="none" />
      </svg>
    </span>
  )
}

/** Marca escrita "Vynkio". */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-zinc-50">Vynkio</span>
    </span>
  )
}
