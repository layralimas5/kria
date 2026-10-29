import { motion, useReducedMotion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { CtaLink } from '../components/CtaLink'
import { ShowcasePhoto } from '../components/ShowcasePhoto'
import { WELCOME_CREDITS } from '../content'
import { SHOWCASE_VISIBLE, showcase } from '../showcase'
import { CARD_HOVER } from '../styles'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const TRUST = ['Comece grátis', 'Tudo em português', 'Custo visível antes de gerar', 'Cancele quando quiser'] as const

const HERO_TILES = [
  {
    image: showcase('hero-criadora'),
    href: '#mesmo-rosto',
    subtitle: 'O mesmo rosto em qualquer cena, foto após foto.',
    alt: 'Criadora de conteúdo gravando vídeo com o celular no tripé, foto gerada no Vynkio',
  },
  {
    image: showcase('hero-imovel'),
    href: '#para-quem',
    subtitle: 'Imóvel, produto e prato: mande a foto, receba o post.',
    alt: 'Sala de estar decorada com luz do fim de tarde, foto gerada no Vynkio',
  },
  {
    image: showcase('hero-produto'),
    href: '#recursos',
    subtitle: 'Da foto ao vídeo em um clique, com Kling e Veo.',
    alt: 'Frasco de sérum sobre pedra molhada com respingos de água, foto gerada no Vynkio',
  },
] as const

export function Hero() {
  const reduceMotion = useReducedMotion()
  const enter = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section
      id="topo"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-[radial-gradient(75%_60%_at_50%_0%,rgba(124,58,237,0.22)_0%,rgba(124,58,237,0.05)_45%,#000_75%)] pt-14"
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
          className="mt-6 text-balance font-landing text-[2.35rem] font-bold uppercase leading-[0.92] tracking-[-0.045em] text-zinc-50 sm:text-[3.4rem] lg:text-[4.6rem]"
        >
          Para quem cria: ideia, roteiro e vídeo com IA <span className="text-accent-soft">num lugar só.</span>
        </motion.h1>
        <motion.p {...enter(0.14)} className="mt-6 max-w-2xl text-pretty text-[17px] font-medium text-zinc-400 md:text-lg">
          Você descreve em português, o Vynkio escreve o roteiro, gera as fotos com o mesmo personagem e transforma em vídeo.
        </motion.p>
        <motion.div {...enter(0.2)} className="mt-9 flex w-full justify-center sm:w-auto">
          <CtaLink cta="hero_primary" size="lg" className="w-full sm:w-auto" />
        </motion.div>
        <motion.ul {...enter(0.26)} className="mt-7 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-zinc-400">
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-4 sm:[&:not(:first-child)]:before:content-['·']">
              {item}
            </li>
          ))}
        </motion.ul>
      </div>

      {SHOWCASE_VISIBLE && (
        <motion.ul
          {...enter(0.32)}
          aria-label="O que dá pra criar"
          className="relative mx-auto mt-14 flex max-w-[1440px] snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mt-16 md:grid md:grid-cols-3 md:overflow-visible"
        >
          {HERO_TILES.map(({ image, href, subtitle, alt }, index) => (
            <li key={image.id} className="w-[82%] shrink-0 snap-start md:w-auto">
              <a
                href={href}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-stage"
              >
                <div className={`overflow-hidden rounded-2xl ring-1 ring-white/[0.08] ${CARD_HOVER}`}>
                  <ShowcasePhoto
                    image={image}
                    alt={alt}
                    eager={index === 0}
                    className="w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <p className="mt-4 font-landing text-[15px] font-bold uppercase tracking-[-0.01em] text-zinc-50">{image.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
              </a>
            </li>
          ))}
        </motion.ul>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-stage to-transparent" />
    </section>
  )
}
