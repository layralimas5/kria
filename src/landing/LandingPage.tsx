import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { REAL_GALLERY } from './content'
import { PRICING_V2 } from './pricing/flags'
import { Advanced } from './sections/Advanced'
import { BusinessSection, CreatorSection } from './sections/Ecosystem'
import { Exclusive } from './sections/Exclusive'
import { Faq } from './sections/Faq'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'
import { Gallery } from './sections/Gallery'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { PhotoGallery } from './sections/PhotoGallery'
import { Pipeline } from './sections/Pipeline'
import { Pricing } from './sections/Pricing'
import { PricingV2 } from './sections/PricingV2'
import { Problem } from './sections/Problem'
import { SameFace } from './sections/SameFace'
import { StartBento } from './sections/StartBento'
import { UseCases } from './sections/UseCases'
import { SHOWCASE_VISIBLE } from './showcase'

// Ordem do modelo de LP (estruturasmdm.lovable.app): topo, primeira dobra, problema,
// plataforma por dentro, recursos avançados, prova social, diferencial, planos,
// objeções e chamada final com rodapé. "Para quem" e "Uma ideia, cinco entregas"
// complementam o problema e a plataforma. Creator (logo depois do topo) e Business (antes dos
// planos) apresentam as duas linhas; os preços v2 só entram com VITE_PRICING_V2. As seções de foto (bento, mesmo rosto e galeria)
// seguem a vitrine da higgsfield.ai e só entram com as fotos geradas.
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
        <CreatorSection />
        {SHOWCASE_VISIBLE && <StartBento />}
        {SHOWCASE_VISIBLE && <SameFace />}
        <Problem />
        <UseCases />
        {SHOWCASE_VISIBLE && <PhotoGallery />}
        <Features />
        <Pipeline />
        <Advanced />
        {REAL_GALLERY && <Gallery />}
        <Exclusive />
        <BusinessSection />
        {PRICING_V2 ? <PricingV2 /> : <Pricing />}
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
