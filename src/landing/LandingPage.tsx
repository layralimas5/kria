import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { REAL_GALLERY } from './content'
import { Advanced } from './sections/Advanced'
import { Exclusive } from './sections/Exclusive'
import { Faq } from './sections/Faq'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'
import { Gallery } from './sections/Gallery'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { Pipeline } from './sections/Pipeline'
import { Pricing } from './sections/Pricing'
import { Problem } from './sections/Problem'
import { UseCases } from './sections/UseCases'

// Ordem do modelo de LP (estruturasmdm.lovable.app): topo, primeira dobra, problema,
// plataforma por dentro, recursos avançados, prova social, diferencial, planos,
// objeções e chamada final com rodapé. "Para quem" e "Uma ideia, cinco entregas"
// complementam o problema e a plataforma.
export function LandingPage() {
  useEffect(() => track({ name: 'landing_view' }), [])

  return (
    <div className="min-h-dvh bg-stage">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        <Hero />
        <Problem />
        <UseCases />
        <Features />
        <Pipeline />
        <Advanced />
        {REAL_GALLERY && <Gallery />}
        <Exclusive />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
