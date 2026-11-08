import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { ModelGrid } from '../components/ModelGrid'
import { Reveal } from '../components/Reveal'
import { BrowserFrame, PhoneFrame, ScreenImage } from '../components/ScreenFrame'

/**
 * O painel real logo abaixo do topo. No desktop ele chega inclinado e se endireita conforme a página
 * desce (só transform, sem prender o scroll). No celular, a tela mobile dentro do aparelho.
 */
export function ProductDemo() {
  const target = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target, offset: ['start end', 'start 0.35'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1])
  const y = useTransform(scrollYProgress, [0, 1], [40, 0])
  const still = reduceMotion ?? false

  return (
    <section id="demo" aria-label="O painel do Vynkio" className="scroll-mt-20 px-4 pt-14 md:pt-20">
      <div ref={target} className="mx-auto max-w-6xl [perspective:1600px]">
        <motion.div style={still ? undefined : { rotateX, scale, y }} className="relative hidden origin-top md:block">
          <div aria-hidden="true" className="absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_30%,rgba(124,58,237,0.35),transparent)] blur-2xl" />
          <BrowserFrame label="Início">
            <ScreenImage screen="dashboard" width={2160} height={1350} alt="Tela inicial do Vynkio com atalhos para Studio, Vynkio AI, personagens e as criações recentes" />
          </BrowserFrame>
        </motion.div>
        <Reveal className="mx-auto w-[78%] max-w-[22rem] md:hidden">
          <PhoneFrame>
            <ScreenImage screen="dashboard-mobile" width={780} height={1688} alt="Tela inicial do Vynkio no celular" />
          </PhoneFrame>
        </Reveal>
        <p className="mt-4 text-center text-xs text-zinc-500">Tela real do app, no modo demonstração.</p>
      </div>
      <Reveal>
        <ModelGrid />
      </Reveal>
    </section>
  )
}
