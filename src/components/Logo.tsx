/** Só o símbolo: quadrado laranja com o K. Usado na barra lateral recolhida. */
export function LogoMark() {
  return (
    <span className="grid size-8 place-items-center rounded-[9px] bg-accent" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="#0b0b0f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4v16" />
        <path d="M18 4 9.5 12 18 20" />
        <circle cx="18.5" cy="12" r="1.6" fill="#0b0b0f" stroke="none" />
      </svg>
    </span>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {/* krIA: o "IA" faz parte do nome, em laranja. */}
      <span className="text-[18px] font-bold tracking-tight text-zinc-50" aria-label="krIA">
        kr<span className="text-accent">IA</span>
      </span>
    </span>
  )
}
