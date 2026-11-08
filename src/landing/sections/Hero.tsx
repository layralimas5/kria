import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, Gift } from 'lucide-react'
import { AnchorButton, CtaLink } from '../components/CtaLink'
import { WELCOME_CREDITS } from '../content'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const TRUST = ['Tudo em português', 'Custo em créditos antes de gerar', 'Falhou, o crédito volta', 'Cancele quando quiser'] as const

/** Luz de fundo: dois brilhos que derivam devagar. Só transform e opacity; parados com movimento reduzido. */
function Glow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.32),transparent)] blur-2xl motion-safe:animate-[hero-drift_18s_ease-in-out_infinite_alternate]" />
      <div className="absolute left-[80%] top-[8rem] h-[26rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.16),transparent)] blur-2xl motion-safe:animate-[hero-drift_22s_ease-in-out_infinite_alternate-reverse]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(60%_50%_at_50%_30%,black,transparent)]" />
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
      <Glow />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pt-14 text-center sm:pt-20 lg:pt-28">
        <motion.p
          {...enter(0)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-zinc-300 ring-1 ring-white/[0.1] backdrop-blur"
        >
          <Gift className="size-3.5 text-accent-soft" aria-hidden="true" />
          {WELCOME_CREDITS} créditos grátis para testar, sem cartão
        </motion.p>
        <motion.h1
          {...enter(0.08)}
          id="hero-title"
          className="mt-7 text-balance font-landing text-[2.5rem] font-bold leading-[0.95] tracking-[-0.045em] text-zinc-50 sm:text-[3.6rem] lg:text-[5rem]"
        >
          Sua próxima grande ideia merece mais do que uma ferramenta.{' '}
          <span className="bg-gradient-to-r from-accent-soft via-[#c4b5fd] to-[#60a5fa] bg-clip-text text-transparent">Merece um estúdio inteiro.</span>
        </motion.h1>
        <motion.p {...enter(0.16)} className="mt-7 max-w-2xl text-pretty text-[17px] text-zinc-400 md:text-lg">
          Crie vídeos, imagens, personagens e roteiros com inteligência artificial em um só lugar. Menos tempo alternando entre plataformas. Mais tempo criando conteúdos
          que chamam atenção.
        </motion.p>
        <motion.div {...enter(0.24)} className="mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <CtaLink cta="hero_primary" size="lg" className="w-full sm:w-auto" />
          <AnchorButton href="#demo" size="lg" tone="ghost" className="w-full sm:w-auto">
            Conhecer o Vynkio
            <ArrowDown className="size-4" aria-hidden="true" />
          </AnchorButton>
        </motion.div>
        <motion.ul {...enter(0.32)} aria-label="Garantias" className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-zinc-400">
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1 rounded-full bg-accent-soft" />
              {item}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
