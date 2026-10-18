import { ArrowUpRight, Check, Clapperboard, ImageIcon, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { CtaLink } from '../components/CtaLink'
import { LoopVideo } from '../components/LoopVideo'
import { Reveal } from '../components/Reveal'
import { avatar, SIGNUP_PATH, TOOLS, WELCOME_CREDITS, type ToolIcon } from '../content'

const ICONS: Record<ToolIcon, LucideIcon> = {
  video: Clapperboard,
  image: ImageIcon,
  persona: UserRound,
  copy: PenLine,
}

const PERKS = ['Vídeo com Veo 3.1 e Kling', 'Foto realista com Nano Banana', 'Crie seu primeiro influenciador'] as const

function PromoCard() {
  return (
    <div className="relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl border border-white/[0.06] p-6 md:p-8">
      <LoopVideo clip={avatar('viagem')} className="absolute inset-0 -z-10 size-full object-cover" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
      <h2 id="ferramentas-title" className="font-display text-[2rem] font-bold uppercase leading-[0.92] tracking-[-0.035em] text-zinc-50 md:text-[2.5rem]">
        Crie sua conta e ganhe
        <br />
        <span className="text-accent">{WELCOME_CREDITS} créditos</span>
      </h2>
      <ul className="mt-4 space-y-1.5 text-sm font-medium text-zinc-200">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-center gap-2">
            <Check className="size-4 text-zinc-400" aria-hidden="true" />
            {perk}
          </li>
        ))}
      </ul>
      <CtaLink className="mt-6 self-start">Criar conta grátis</CtaLink>
    </div>
  )
}

export function Tools() {
  return (
    <section id="ferramentas" aria-labelledby="ferramentas-title" className="scroll-mt-16 px-4 pt-2">
      <Reveal className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[1.1fr_1.5fr]">
        <PromoCard />
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {TOOLS.map(({ title, description, icon, badge }) => {
            const Icon = ICONS[icon]
            return (
              <li key={title}>
                <Link
                  to={SIGNUP_PATH}
                  className="group flex h-full min-h-[136px] flex-col rounded-2xl border border-white/[0.06] bg-panel p-4 transition-colors hover:border-white/[0.12] hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="flex items-start justify-between">
                    <Icon className="size-5 text-accent" aria-hidden="true" />
                    <ArrowUpRight className="size-4 text-zinc-600 transition-colors group-hover:text-zinc-200" aria-hidden="true" />
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-2 pt-6 text-[15px] font-semibold text-zinc-50">
                    {title}
                    {badge && <Badge kind={badge} />}
                  </span>
                  <span className="mt-1 text-[13px] text-zinc-500">{description}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Reveal>
    </section>
  )
}
