import { Zap } from 'lucide-react'
import { WELCOME_CREDITS } from '../content'

// Só fatos que o produto cumpre. Nada de "oferta por tempo limitado" sem oferta.
const ITEMS = [
  `${WELCOME_CREDITS} créditos grátis pra testar`,
  'Cancele quando quiser',
  'Créditos não vencem',
  'Tudo em português',
  'O mesmo rosto em todos os vídeos',
] as const

function Row({ hidden = false }: { readonly hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden || undefined}>
      {ITEMS.map((item) => (
        <li key={item} className="flex items-center gap-2 whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.06em]">
          <Zap className="size-3.5 fill-current" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Faixa que rola no topo. Com movimento reduzido, fica parada. */
export function Marquee() {
  return (
    <div className="overflow-hidden bg-accent text-accent-ink">
      <div className="flex h-8 w-max animate-marquee items-center hover:[animation-play-state:paused] motion-reduce:animate-none">
        <Row />
        <Row hidden />
        <Row hidden />
      </div>
    </div>
  )
}
