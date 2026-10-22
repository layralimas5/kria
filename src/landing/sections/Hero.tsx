import { motion, useReducedMotion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { AnchorButton, CtaLink } from '../components/CtaLink'
import { BrowserFrame, PhoneFrame, ScreenImage } from '../components/ScreenFrame'
import { WELCOME_CREDITS } from '../content'
import { useMediaQuery } from '../hooks/useMediaQuery'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const TRUST = ['Comece grátis', 'Tudo em português', 'Custo visível antes de gerar', 'Cancele quando quiser'] as const

export function Hero() {
  const reduceMotion = useReducedMotion()
  // Só um dos prints é baixado: o do painel no desktop, o do celular no resto.
  const desktop = useMediaQuery('(min-width: 768px)')
  const enter = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section
      id="topo"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-[radial-gradient(75%_60%_at_50%_0%,#241a45_0%,#110f24_60%,#0b0a1a_100%)] pt-14"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_55%_at_50%_25%,black,transparent)]"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pt-14 text-center md:pt-20 lg:pt-24">
        <motion.p
          {...enter(0)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[13px] font-semibold text-accent-soft ring-1 ring-accent/30"
        >
          <Gift className="size-3.5" aria-hidden="true" />
          {WELCOME_CREDITS} créditos grátis ao criar a conta
        </motion.p>
        <motion.h1
          {...enter(0.08)}
          id="hero-title"
          className="mt-6 text-balance font-landing text-[2.6rem] font-bold uppercase leading-[0.9] tracking-[-0.045em] text-zinc-50 sm:text-6xl lg:text-[5.4rem]"
        >
          Sua ideia merece <span className="text-accent-soft">mais do que um prompt.</span>
        </motion.h1>
        <motion.p {...enter(0.14)} className="mt-6 max-w-2xl text-pretty text-[17px] font-medium text-zinc-400 md:text-lg">
          Crie vídeos, imagens, personagens, roteiros e conteúdos com inteligência artificial. Tudo em um só lugar, do primeiro conceito à
          produção final.
        </motion.p>
        <motion.div {...enter(0.2)} className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <CtaLink cta="hero_primary" size="lg" className="w-full sm:w-auto">
            Começar a criar
          </CtaLink>
          <AnchorButton href="#recursos" size="lg" tone="ghost" className="w-full sm:w-auto">
            Explorar recursos
          </AnchorButton>
        </motion.div>
        <motion.ul {...enter(0.26)} className="mt-7 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-zinc-400">
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-4 sm:[&:not(:first-child)]:before:content-['·']">
              {item}
            </li>
          ))}
        </motion.ul>
      </div>

      <motion.div {...enter(0.32)} className="relative mx-auto mt-14 max-w-6xl px-4 md:mt-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] -top-10 h-40 rounded-full bg-accent/25 blur-3xl" />
        {desktop ? (
          <BrowserFrame label="Início" className="relative">
            <ScreenImage
              screen="dashboard"
              eager
              width={2160}
              height={1350}
              alt="Painel inicial do Vynkio: saldo de créditos, plano atual, atalhos de criação rápida e criações recentes, com o menu de Studio, Vynkio AI e Workspace"
            />
          </BrowserFrame>
        ) : (
          <PhoneFrame className="relative mx-auto w-[78%] max-w-[320px]">
            <ScreenImage
              screen="dashboard-mobile"
              eager
              width={780}
              height={1688}
              alt="Painel inicial do Vynkio no celular: saldo de créditos, plano atual e atalhos de criação"
            />
          </PhoneFrame>
        )}
        <p className="mt-4 text-center text-xs text-zinc-400">Tela real do Vynkio no modo demonstração, com dados de exemplo.</p>
      </motion.div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-stage to-transparent" />
    </section>
  )
}
