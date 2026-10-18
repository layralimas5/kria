import { CtaLink } from '../components/CtaLink'
import { Reveal } from '../components/Reveal'
import { WELCOME_CREDITS } from '../content'

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden py-24 md:py-32">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-80 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(198,244,50,0.14),transparent)]" />
      <Reveal className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 id="final-title" className="text-balance text-4xl font-semibold tracking-tight text-zinc-50 md:text-6xl">
          Seu próximo post não precisa de câmera
        </h2>
        <p className="mt-5 text-pretty text-lg text-zinc-400">
          Cria a conta, usa os {WELCOME_CREDITS} créditos de presente e vê o primeiro vídeo ficar pronto.
        </p>
        <div className="mt-9 flex justify-center">
          <CtaLink />
        </div>
      </Reveal>
    </section>
  )
}
