import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { CtaLink, SecondaryLink } from '../components/CtaLink'
import { PhoneVideo } from '../components/PhoneVideo'
import { SHOWCASE } from '../content'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
const PROOF_POINTS = ['Sem mensalidade', 'Paga com Pix', 'Tudo em português'] as const
const MODELS = ['Veo 3.1', 'Kling', 'Nano Banana'] as const

function PhoneStack() {
  const reduceMotion = useReducedMotion()
  const [left, center, right] = SHOWCASE
  if (!left || !center || !right) return null

  const enter = (delay: number, x: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 40, x },
    animate: { opacity: 1, y: 0, x: 0 },
    transition: { duration: 0.8, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <div className="relative mx-auto flex h-[440px] w-full max-w-[460px] items-center justify-center sm:h-[520px]">
      <div aria-hidden="true" className="absolute inset-x-6 top-1/2 h-72 -translate-y-1/2 rounded-full bg-accent/20 blur-[90px]" />
      <motion.div {...enter(0.25, 40)} className="absolute left-0 top-12 w-[150px] -rotate-[8deg] sm:left-2 sm:w-[180px]">
        <PhoneVideo video={left} />
      </motion.div>
      <motion.div {...enter(0.4, -40)} className="absolute right-0 top-12 w-[150px] rotate-[8deg] sm:right-2 sm:w-[180px]">
        <PhoneVideo video={right} />
      </motion.div>
      <motion.div {...enter(0.1, 0)} className="relative z-10 w-[190px] sm:w-[230px]">
        <PhoneVideo video={center} showPrompt eager />
      </motion.div>
    </div>
  )
}

export function Hero() {
  const reduceMotion = useReducedMotion()
  const fadeUp = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section id="topo" aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(198,244,50,0.10),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-24">
        <div className="text-center lg:text-left">
          <motion.p
            {...fadeUp(0)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300"
          >
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Vídeo, imagem e influenciador com IA
          </motion.p>
          <motion.h1
            {...fadeUp(0.06)}
            id="hero-title"
            className="mt-5 text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl lg:text-[4.2rem]"
          >
            Você descreve.
            <br />
            <span className="text-accent">A IA grava.</span>
          </motion.h1>
          <motion.p {...fadeUp(0.12)} className="mx-auto mt-5 max-w-xl text-pretty text-base text-zinc-400 sm:text-lg lg:mx-0">
            O Kria junta as melhores IAs de vídeo e imagem num lugar só, em português. Escreve o que você quer e recebe o
            conteúdo pronto pra postar, sem câmera, sem estúdio e sem aparecer.
          </motion.p>
          <motion.div {...fadeUp(0.18)} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <CtaLink className="w-full sm:w-auto" />
            <SecondaryLink href="#exemplos">Ver exemplos</SecondaryLink>
          </motion.div>
          <motion.ul {...fadeUp(0.24)} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-zinc-400 lg:justify-start">
            {PROOF_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Check className="size-4 text-accent" aria-hidden="true" />
                {point}
              </li>
            ))}
          </motion.ul>
          <motion.p {...fadeUp(0.3)} className="mt-10 text-xs text-zinc-500">
            Por trás:{' '}
            {MODELS.map((model, index) => (
              <span key={model}>
                <span className="font-medium text-zinc-300">{model}</span>
                {index < MODELS.length - 1 && <span aria-hidden="true"> · </span>}
              </span>
            ))}
          </motion.p>
        </div>
        <PhoneStack />
      </div>
    </section>
  )
}
