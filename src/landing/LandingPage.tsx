import { useEffect } from 'react'
import { track } from '@/lib/analytics'
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
// Os preços v2 só entram com VITE_PRICING_V2, junto com a virada.
export function LandingPage() {
  useEffect(() => track({ name: 'landing_view' }), [])

  return (
    <div className="min-h-dvh overflow-x-clip bg-stage">
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
