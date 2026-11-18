import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Play, Sparkles } from 'lucide-react'
import { AnchorButton, CtaLink } from '../components/CtaLink'
import { HeroShowcase } from '../components/HeroShowcase'
import { WELCOME_CREDITS } from '../content'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const TRUST = [`${WELCOME_CREDITS} créditos grátis, sem cartão`, 'Falhou, o crédito volta', 'Cancele quando quiser'] as const

/** Luz de fundo: dois brilhos que derivam devagar, um halo atrás do título e grão bem leve. Parados com movimento reduzido. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-20rem] h-[44rem] w-[76rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.34),transparent)] blur-2xl motion-safe:animate-[hero-drift_18s_ease-in-out_infinite_alternate]" />
      <div className="absolute left-[82%] top-[10rem] h-[26rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.16),transparent)] blur-2xl motion-safe:animate-[hero-drift_22s_ease-in-out_infinite_alternate-reverse]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(55%_45%_at_50%_25%,black,transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-soft/40 to-transparent" />
    </div>
  )
}

export function Hero() {
  const reduceMotion = useReducedMotion()
  const enter = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.9, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section id="topo" aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-16">
      <Backdrop />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-12 text-center sm:px-6 sm:pt-16 lg:pt-20">
        <motion.p
          {...enter(0)}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 ring-1 ring-white/[0.1] backdrop-blur sm:text-xs"
        >
          <Sparkles className="size-3.5 text-accent-soft" aria-hidden="true" />
          Sua nova central de criação com IA
        </motion.p>

        <motion.h1
          {...enter(0.1)}
          id="hero-title"
          className="mt-7 max-w-[15ch] text-balance font-landing text-[2.35rem] font-bold leading-[1] tracking-[-0.045em] text-zinc-50 sm:max-w-[18ch] sm:text-[3.5rem] lg:max-w-none lg:text-[4.25rem] xl:text-[4.6rem]"
        >
          <span className="block">Sua criatividade não tem limites.</span>{' '}
          <span className="block text-zinc-300">
            Suas ferramentas também{' '}
            <span className="bg-gradient-to-r from-accent-soft lg:block via-[#c4b5fd] to-galaxy bg-clip-text text-transparent">não deveriam ter.</span>
          </span>
        </motion.h1>

        <motion.p {...enter(0.2)} className="mt-6 max-w-[34rem] text-pretty text-base leading-relaxed text-zinc-400 sm:mt-7 sm:text-lg">
          Crie imagens, vídeos e conteúdos com inteligência artificial em um só lugar. Menos ferramentas, mais possibilidades para transformar suas ideias em
          conteúdo.
        </motion.p>

        <motion.div {...enter(0.3)} className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <CtaLink
            cta="hero_primary"
            size="lg"
            tone="glow"
            className="group w-full sm:w-auto"
          >
            Começar a criar
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </CtaLink>
          <AnchorButton href="#demo" size="lg" tone="ghost" className="group w-full backdrop-blur sm:w-auto">
            <Play className="size-4 fill-current text-accent-soft transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
            Conhecer a plataforma
          </AnchorButton>
        </motion.div>

        <motion.ul {...enter(0.38)} aria-label="Garantias" className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-zinc-500">
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1 rounded-full bg-accent-soft" />
              {item}
            </li>
          ))}
        </motion.ul>

        <HeroShowcase />
      </div>
    </section>
  )
}
