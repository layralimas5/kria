import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { useEffect, useState, type PointerEvent } from 'react'
import { track } from '@/lib/analytics'
import { captureUtmFromLocation } from '@/lib/utm'
import { IdeasMarquee } from './components/IdeasMarquee'
import { PRICING_V2 } from './pricing/flags'
import { Examples } from './sections/Examples'
import { Faq } from './sections/Faq'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { Pricing } from './sections/Pricing'
import { PricingV2 } from './sections/PricingV2'
import { ProductDemo } from './sections/ProductDemo'
import { Studio } from './sections/Studio'
import { VideoTour } from './sections/VideoTour'
import { Workflow } from './sections/Workflow'

// Ordem: topo, demonstração do painel, o estúdio e para quem, showcase das ferramentas, vídeo,
// comparação de fluxos, exemplos reais (só com mídia gerada), planos, dúvidas, chamada final e rodapé.
// Preços v2 ligados desde a virada (0027); `VITE_PRICING_V2=false` volta a vitrine antiga.
/** Barra fina no topo que acompanha a leitura da página. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 })
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-accent via-[#c4b5fd] to-[#60a5fa]"
    />
  )
}

/** Leva a posição do mouse para o card sob ele (luz do `spotlight`). Um só ouvinte para a página toda. */
function followSpotlight(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse') return
  const card = (event.target as Element).closest<HTMLElement>('.spotlight')
  if (!card) return
  const box = card.getBoundingClientRect()
  card.style.setProperty('--spot-x', `${event.clientX - box.left}px`)
  card.style.setProperty('--spot-y', `${event.clientY - box.top}px`)
}

export function LandingPage() {
  // Antes do primeiro render: os CTAs montam o link com a UTM já guardada.
  useState(captureUtmFromLocation)
  useEffect(() => {
    track({ name: 'landing_view' })
  }, [])

  return (
    <div className="min-h-dvh overflow-x-clip bg-stage" onPointerMove={followSpotlight}>
      <ScrollProgress />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        <Hero />
        <ProductDemo />
        <Studio />
        <IdeasMarquee />
        <Features />
        <VideoTour />
        <Workflow />
        <Examples />
        {PRICING_V2 ? <PricingV2 /> : <Pricing />}
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
