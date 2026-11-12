import { Clapperboard, Copy, ImageIcon, Lightbulb, PenLine, UserRound, Wand2, type LucideIcon } from 'lucide-react'

const IDEAS: readonly { readonly icon: LucideIcon; readonly text: string }[] = [
  { icon: UserRound, text: 'Influenciadora tomando café em Lisboa' },
  { icon: Clapperboard, text: 'Ela olha para a câmera e diz "bom dia"' },
  { icon: Wand2, text: 'Antes e depois da reforma da sala' },
  { icon: PenLine, text: 'Roteiro de Reels de 30 segundos' },
  { icon: ImageIcon, text: 'Tênis branco sobre pedra molhada, luz neon' },
  { icon: Copy, text: '10 variações do mesmo vídeo para anúncio' },
  { icon: Lightbulb, text: 'Ideias de posts para a semana' },
  { icon: Wand2, text: 'Tour pelo apartamento decorado' },
  { icon: PenLine, text: 'Legenda para lançar um produto' },
  { icon: ImageIcon, text: 'Prato de massa fresca com luz de janela' },
]

const EDGE_FADE = '[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]'

function IdeaList({ hidden = false }: { readonly hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className={`flex shrink-0 items-center gap-3 pr-3 ${hidden ? 'motion-reduce:hidden' : ''}`}>
      {IDEAS.map(({ icon: Icon, text }) => (
        <li key={text} className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.035] px-4 py-2 text-[14px] text-zinc-300 ring-1 ring-white/[0.07]">
          <Icon className="size-4 shrink-0 text-accent-soft" aria-hidden="true" />
          <span className="whitespace-nowrap">{text}</span>
        </li>
      ))}
    </ul>
  )
}

/** Faixa com exemplos do que dá para criar, correndo ao contrário da faixa de IAs. Para ao passar o mouse. */
export function IdeasMarquee() {
  return (
    <section aria-label="Exemplos do que dá para criar" className="py-10 md:py-14">
      <div className={`group flex overflow-hidden ${EDGE_FADE}`}>
        <div className="flex w-max animate-marquee [animation-direction:reverse] [animation-duration:60s] group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-3">
          <IdeaList />
          <IdeaList hidden />
        </div>
      </div>
    </section>
  )
}
