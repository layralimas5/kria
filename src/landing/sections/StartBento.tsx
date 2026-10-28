import { BarChart3, CalendarDays, Check, Clapperboard, LayoutTemplate, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { track } from '@/lib/analytics'
import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { ShowcasePhoto } from '../components/ShowcasePhoto'
import { SIGNUP_PATH, WELCOME_CREDITS } from '../content'
import { showcase } from '../showcase'
import { CARD_HOVER } from '../styles'

interface Tool {
  readonly icon: LucideIcon
  readonly name: string
  readonly detail: string
  readonly isNew?: boolean
}

const TOOLS: readonly Tool[] = [
  { icon: Clapperboard, name: 'Studio', detail: 'Foto e vídeo com Nano Banana, Kling e Veo' },
  { icon: UserRound, name: 'Personagens', detail: 'O mesmo rosto em toda geração' },
  { icon: LayoutTemplate, name: 'Formatos', detail: 'Imóvel, produto e prato prontos', isNew: true },
  { icon: Sparkles, name: 'Vynkio AI', detail: 'Ideia, roteiro e copy em português' },
  { icon: CalendarDays, name: 'Conteúdos', detail: 'Quadro e calendário dos posts' },
  { icon: BarChart3, name: 'Resultados', detail: 'O que funcionou, direto do CSV da rede' },
]

const PERKS = ['Sem cartão de crédito', 'Custo de cada geração antes de gerar', 'Falhou, o crédito volta'] as const

export function StartBento() {
  return (
    <section aria-labelledby="comece-title" className="px-4 pt-16 md:pt-20">
      <div className="mx-auto grid max-w-[1440px] gap-3 lg:grid-cols-[1.15fr_1fr]">
        <Reveal className="relative isolate flex min-h-[340px] flex-col justify-end overflow-hidden rounded-3xl p-6 ring-1 ring-white/[0.08] md:p-9">
          <ShowcasePhoto
            image={showcase('bento-cidade')}
            alt=""
            keepAspect={false}
            className="absolute inset-0 -z-10 size-full"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-stage via-stage/80 to-stage/10" />
          <h2 id="comece-title" className="max-w-md font-landing text-[2rem] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-zinc-50 md:text-[2.6rem]">
            Crie a conta e ganhe <span className="text-hot">{WELCOME_CREDITS} créditos</span>
          </h2>
          <ul className="mt-5 space-y-2 text-sm text-zinc-200">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <Check className="size-4 text-accent-soft" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
          <CtaLink cta="start_bento" size="lg" className="mt-7 self-start" />
        </Reveal>

        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {TOOLS.map(({ icon: Icon, name, detail, isNew }, index) => (
            <Reveal key={name} as="li" delay={index * 0.04} className={`rounded-2xl ${CARD_HOVER}`}>
              <Link
                to={SIGNUP_PATH}
                onClick={() => track({ name: 'cta_click', params: { cta_id: `bento_${name.toLowerCase()}`, destination: SIGNUP_PATH } })}
                className="flex h-full min-h-[150px] flex-col justify-between rounded-2xl border border-white/[0.06] bg-panel p-5 transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon className="size-5 text-accent-soft" aria-hidden="true" />
                <span>
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-zinc-50">
                    {name}
                    {isNew && <span className="rounded bg-hot px-1.5 py-0.5 text-[10px] font-bold uppercase text-stage">Novo</span>}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-zinc-400">{detail}</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
