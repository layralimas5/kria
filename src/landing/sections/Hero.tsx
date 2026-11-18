import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, Play, Sparkles } from 'lucide-react'
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
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-10 text-center sm:px-6 sm:pt-12 lg:pt-10">
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
          className="mt-6 max-w-[14ch] text-balance font-landing text-[2.4rem] font-bold leading-[1] tracking-[-0.045em] text-zinc-50 sm:max-w-[20ch] sm:text-[3.5rem] lg:text-[3.75rem] xl:text-[4.1rem]"
        >
          <span className="block text-balance">Tudo o que você precisa para criar com IA.</span>{' '}
          <span className="mt-1 block bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-galaxy bg-clip-text pb-[0.08em] text-transparent">Em um só lugar.</span>
        </motion.h1>

        <motion.p {...enter(0.2)} className="mt-5 max-w-[38rem] text-pretty text-base leading-relaxed text-zinc-300/80 sm:text-[17px] lg:text-lg">
          Crie vídeos incríveis, imagens profissionais e conteúdos que chamam atenção usando inteligência artificial. Explore ferramentas poderosas sem
          precisar alternar entre várias plataformas.
        </motion.p>

        <motion.div {...enter(0.3)} className="mt-8 flex w-full flex-col lg:mt-7 justify-center gap-3 sm:w-auto sm:flex-row">
          <CtaLink
            cta="hero_primary"
            size="lg"
            tone="glow"
            className="group w-full sm:w-auto"
          >
            Começar a criar
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </CtaLink>
          <AnchorButton href="#como-funciona" size="lg" tone="ghost" className="group w-full backdrop-blur sm:w-auto">
            <Play className="size-4 fill-current text-accent-soft transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
            Conhecer a plataforma
          </AnchorButton>
        </motion.div>

        <motion.ul
          {...enter(0.38)}
          aria-label="Garantias"
          className="mt-6 flex flex-col items-center gap-2 text-sm lg:mt-5 text-zinc-300 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-7"
        >
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-accent/20 text-accent-soft ring-1 ring-accent/30">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </motion.ul>

        <HeroShowcase />
      </div>
    </section>
  )
}
