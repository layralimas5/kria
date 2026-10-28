import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { REAL_GALLERY } from './content'
import { Advanced } from './sections/Advanced'
import { Exclusive } from './sections/Exclusive'
import { Faq } from './sections/Faq'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import { FormatsBanner } from './sections/FormatsBanner'
import { Footer } from './sections/Footer'
import { Gallery } from './sections/Gallery'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { PhotoGallery } from './sections/PhotoGallery'
import { Pipeline } from './sections/Pipeline'
import { Pricing } from './sections/Pricing'
import { Problem } from './sections/Problem'
import { SameFace } from './sections/SameFace'
import { StartBento } from './sections/StartBento'
import { UseCases } from './sections/UseCases'
import { SHOWCASE_VISIBLE } from './showcase'

// Ordem do modelo de LP (estruturasmdm.lovable.app): topo, primeira dobra, problema,
// plataforma por dentro, recursos avançados, prova social, diferencial, planos,
// objeções e chamada final com rodapé. "Para quem" e "Uma ideia, cinco entregas"
// complementam o problema e a plataforma. As seções de foto (bento, mesmo rosto, galeria
// e formatos) seguem a vitrine da higgsfield.ai e só entram com as fotos geradas.
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
        {SHOWCASE_VISIBLE && <StartBento />}
        {SHOWCASE_VISIBLE && <SameFace />}
        <Problem />
        <UseCases />
        {SHOWCASE_VISIBLE && <PhotoGallery />}
        {SHOWCASE_VISIBLE && <FormatsBanner />}
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
