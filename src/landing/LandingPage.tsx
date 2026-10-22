import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { REAL_GALLERY } from './content'
import { Faq } from './sections/Faq'
import { Features } from './sections/Features'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'
import { Gallery } from './sections/Gallery'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { HowItWorks } from './sections/HowItWorks'
import { Pipeline } from './sections/Pipeline'
import { Pricing } from './sections/Pricing'
import { Problem } from './sections/Problem'
import { UseCases } from './sections/UseCases'

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
        <Features />
        <HowItWorks />
        <UseCases />
        <Pipeline />
        {REAL_GALLERY && <Gallery />}
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
