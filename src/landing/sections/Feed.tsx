import { BadgeDollarSign, Flame, Megaphone, type LucideIcon } from 'lucide-react'
import { LoopVideo } from '../components/LoopVideo'
import { Reveal } from '../components/Reveal'
import { AVATARS } from '../content'
import { CARD_HOVER } from '../styles'

const REASONS: readonly { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Flame, title: 'Prende quem está rolando o feed', text: 'O personagem fora do comum faz a pessoa parar, assistir até o fim e mandar pros amigos.' },
  { icon: Megaphone, title: 'Vira espaço de anúncio', text: 'Com público, o personagem apresenta produto, entra em campanha e fecha publi.' },
  { icon: BadgeDollarSign, title: 'Vira um serviço pra vender', text: 'Você pode criar esses vídeos para marcas, lojas e outros criadores.' },
]

const STRIP = AVATARS.slice(0, 5)

export function Feed() {
  return (
    <section aria-labelledby="feed-title" className="pt-6">
      <ul className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-auto lg:max-w-[1440px] lg:justify-center lg:overflow-visible">
        {STRIP.map((clip) => (
          <li key={clip.id} className="w-[46%] shrink-0 snap-center sm:w-[30%] lg:w-auto lg:flex-1">
            <figure className={`overflow-hidden rounded-2xl border border-white/[0.06] bg-panel ${CARD_HOVER}`}>
              <LoopVideo clip={clip} className="aspect-[9/16] w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-2 px-3 py-2.5 text-[12px]">
                <span className="truncate font-semibold text-zinc-100">{clip.title}</span>
                <span className="shrink-0 text-zinc-500">krIA</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <div className="mx-auto max-w-6xl px-4 pt-20 md:pt-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Influenciadores de IA</p>
          <h2 id="feed-title" className="mt-3 text-balance font-landing text-3xl font-bold uppercase leading-[0.95] tracking-[-0.03em] text-zinc-50 md:text-5xl">
            Eles já estão no seu feed. <span className="text-accent">Você só não sabia que eram IA.</span>
          </h2>
          <p className="mt-4 text-pretty text-[15px] text-zinc-400 md:text-base">
            Personagens que parecem gente de verdade, em situações absurdas, que chegam a milhões de visualizações. Agora você cria o seu.
          </p>
        </Reveal>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} as="li" delay={index * 0.06} className={`rounded-2xl border border-white/[0.06] bg-panel p-6 ${CARD_HOVER}`}>
              <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-zinc-50">{title}</h3>
              <p className="mt-1.5 text-pretty text-[15px] text-zinc-400">{text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
