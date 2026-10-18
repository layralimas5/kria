import clsx from 'clsx'
import { Clapperboard, ImageIcon, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { CAPABILITIES, type CapabilityId } from '../content'

const ICONS: Record<CapabilityId, LucideIcon> = {
  video: Clapperboard,
  image: ImageIcon,
  persona: UserRound,
  copy: PenLine,
}

export function Capabilities() {
  return (
    <section id="criar" aria-labelledby="criar-title" className="scroll-mt-20 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            id="criar-title"
            eyebrow="O que dá pra criar"
            title="Um lugar só pra todo o conteúdo do seu perfil"
            lead="Sem pular de ferramenta em ferramenta, sem assinatura em dólar e sem tutorial em inglês."
          />
        </Reveal>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map(({ id, title, description, detail, soon }, index) => {
            const Icon = ICONS[id]
            return (
              <Reveal
                key={id}
                as="li"
                delay={index * 0.06}
                className={clsx(
                  'relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors duration-200 hover:border-white/[0.16] md:p-8',
                  id === 'video' && 'bg-gradient-to-br from-accent/[0.08] to-transparent',
                )}
              >
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-zinc-900 text-accent">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    {soon && (
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                        Chega em breve
                      </span>
                    )}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-zinc-50">{title}</h3>
                  <p className="mt-2 text-pretty text-zinc-400">{description}</p>
                  <p className="mt-auto pt-6 text-sm font-medium text-zinc-300">{detail}</p>
              </Reveal>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
