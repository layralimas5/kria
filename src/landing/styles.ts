/** Hover dos cards da landing: sobe um pouco, acende a borda e uma luz segue o mouse (`spotlight`). */
export const CARD_HOVER =
  'spotlight relative transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_24px_60px_-28px_rgba(124,58,237,0.55)] focus-within:border-accent/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0'

/** Vidro discreto: só onde o fundo tem brilho por trás. */
export const GLASS = 'bg-white/[0.03] ring-1 ring-white/[0.08] backdrop-blur-md'
